/**
 * The hourly job (docs/adr/0007-tarefas-agendadas.md). Every step is
 * idempotent: running it twice, or late, never sends a duplicate e-mail or
 * expires something twice. A lease on job_runs keeps two runs from overlapping.
 */
import { and, eq, gt, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'

import * as schema from '../db/schema'
import { deliverDueEmails, type DeliveryDeps, type DeliveryReport } from '../email/outbox'
import { enqueueEmail } from '../email/enqueue'
import type { Db } from '../scheduling/context'
import { addDays, addMinutes, instantToLocal, localToInstant, todayLocal } from '../scheduling/time'

/** Reminder for tomorrow's appointments goes out from 18:00 the day before (P33). */
export const REMINDER_FROM_HOUR = 18
/** Daily summary for the Luísa from 07:00. */
export const SUMMARY_FROM_HOUR = 7

export const RETENTION = {
  /** Health data (allergies): deleted this long after the appointment (P24). */
  allergyDays: 30,
  /** Clients with no appointment for this long are anonymised (P24). */
  inactiveClientDays: 730,
  authAttemptsDays: 30,
  sessionsDays: 30,
  sentEmailsDays: 90,
} as const

export type HourlyReport = {
  expired: number
  reminders: number
  summary: boolean
  allergiesErased: number
  clientsAnonymised: number
  purged: number
  emails: DeliveryReport
  skipped?: 'locked'
}

async function expirePending(db: Db, now: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.bookings)
      .set({
        status: 'cancelado',
        cancelReason: 'expirado',
        cancelledAt: now,
        expiresAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bookings.status, 'pendente'),
          isNotNull(schema.bookings.expiresAt),
          lt(schema.bookings.expiresAt, now),
        ),
      )
      .returning({ id: schema.bookings.id })
    for (const { id } of rows) {
      await tx
        .insert(schema.bookingEvents)
        .values({ bookingId: id, type: 'expired', actor: 'sistema', data: {}, createdAt: now })
      await enqueueEmail(tx, {
        kind: 'booking_expired',
        recipient: 'cliente',
        bookingId: id,
        dedupeKey: `booking_expired:cliente:${id}`,
        createdAt: now,
      })
    }
    return rows.length
  })
}

const localHour = (now: Date) => Math.floor(instantToLocal(now).minutes / 60)

async function queueReminders(db: Db, now: Date): Promise<number> {
  if (localHour(now) < REMINDER_FROM_HOUR) return 0
  const tomorrow = addDays(todayLocal(now), 1)
  const rows = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(
      and(
        eq(schema.bookings.status, 'confirmado'),
        sql`${schema.bookings.startsAt} >= ${localToInstant(tomorrow, 0)}`,
        sql`${schema.bookings.startsAt} < ${localToInstant(addDays(tomorrow, 1), 0)}`,
        sql`${schema.customers.email} <> ''`,
      ),
    )
  for (const { id } of rows) {
    // The dedupe key makes this a no-op on the following hourly runs.
    await enqueueEmail(db, {
      kind: 'booking_reminder',
      recipient: 'cliente',
      bookingId: id,
      dedupeKey: `booking_reminder:${id}:${tomorrow}`,
      createdAt: now,
    })
  }
  return rows.length
}

async function queueDailySummary(db: Db, now: Date): Promise<boolean> {
  if (localHour(now) < SUMMARY_FROM_HOUR) return false
  const today = todayLocal(now)
  await enqueueEmail(db, {
    kind: 'daily_summary',
    recipient: 'luisa',
    dedupeKey: `daily_summary:${today}`,
    data: { date: today },
    createdAt: now,
  })
  return true
}

async function applyRetention(db: Db, now: Date) {
  const allergies = await db
    .update(schema.bookings)
    .set({ allergyNotesEnc: null, updatedAt: now })
    .where(
      and(
        isNotNull(schema.bookings.allergyNotesEnc),
        lt(schema.bookings.endsAt, addMinutes(now, -RETENTION.allergyDays * 24 * 60)),
      ),
    )
    .returning({ id: schema.bookings.id })

  const cutoff = addMinutes(now, -RETENTION.inactiveClientDays * 24 * 60)
  const inactive = await db.execute<{ id: string }>(sql`
    select c.id from customers c
    where c.anonymized_at is null and c.created_at < ${cutoff}
      and not exists (select 1 from bookings b where b.customer_id = c.id and b.ends_at >= ${cutoff})
    limit 50`)
  for (const { id } of inactive.rows) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.customers)
        .set({
          name: 'Cliente removida',
          email: '',
          phoneE164: `anon:${id}`,
          cpfEnc: null,
          internalNotesEnc: null,
          anonymizedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.customers.id, id))
      await tx
        .update(schema.bookings)
        .set({
          addressEnc: '',
          complementEnc: null,
          lookNotesEnc: null,
          allergyNotesEnc: null,
          internalNotesEnc: null,
        })
        .where(eq(schema.bookings.customerId, id))
    })
  }

  const days = (n: number) => addMinutes(now, -n * 24 * 60)
  const purged = await Promise.all([
    db
      .delete(schema.authAttempts)
      .where(lt(schema.authAttempts.createdAt, days(RETENTION.authAttemptsDays)))
      .returning({ id: schema.authAttempts.id }),
    db
      .delete(schema.adminSessions)
      .where(lt(schema.adminSessions.expiresAt, days(RETENTION.sessionsDays)))
      .returning({ id: schema.adminSessions.id }),
    db
      .delete(schema.adminPasswordResets)
      .where(lt(schema.adminPasswordResets.expiresAt, days(1)))
      .returning({ t: schema.adminPasswordResets.tokenHash }),
    db
      .delete(schema.bookingTokens)
      .where(lt(schema.bookingTokens.expiresAt, days(1)))
      .returning({ id: schema.bookingTokens.id }),
    db
      .delete(schema.emailOutbox)
      .where(
        and(
          sql`${schema.emailOutbox.status} <> 'pendente'`,
          lt(schema.emailOutbox.createdAt, days(RETENTION.sentEmailsDays)),
        ),
      )
      .returning({ id: schema.emailOutbox.id }),
  ])
  return {
    allergiesErased: allergies.length,
    clientsAnonymised: inactive.rows.length,
    purged: purged.reduce((n, r) => n + r.length, 0),
  }
}

export async function runHourly(db: Db, deps: DeliveryDeps): Promise<HourlyReport> {
  const now = deps.now
  const [run] = await db
    .insert(schema.jobRuns)
    .values({ job: 'hourly', startedAt: now })
    .returning({ id: schema.jobRuns.id })
  const finish = (ok: boolean, report: object) =>
    db
      .update(schema.jobRuns)
      .set({ ok, finishedAt: new Date(), report })
      .where(eq(schema.jobRuns.id, run!.id))

  // Lease instead of a session advisory lock (pool-safe): skip if another run started in
  // the last 10 minutes and has not finished. Two simultaneous starts both skip; the next
  // hour runs normally.
  const [other] = await db
    .select({ id: schema.jobRuns.id })
    .from(schema.jobRuns)
    .where(
      and(
        eq(schema.jobRuns.job, 'hourly'),
        isNull(schema.jobRuns.finishedAt),
        gt(schema.jobRuns.startedAt, addMinutes(now, -10)),
        ne(schema.jobRuns.id, run!.id),
      ),
    )
    .limit(1)
  if (other) {
    const report = { skipped: 'locked' as const }
    await finish(true, report)
    return {
      expired: 0,
      reminders: 0,
      summary: false,
      allergiesErased: 0,
      clientsAnonymised: 0,
      purged: 0,
      emails: { sent: 0, retried: 0, failed: 0, discarded: 0 },
      ...report,
    }
  }
  try {
    const expired = await expirePending(db, now)
    const reminders = await queueReminders(db, now)
    const summary = await queueDailySummary(db, now)
    const retention = await applyRetention(db, now)
    const emails = await deliverDueEmails(db, deps, 50)
    const report: HourlyReport = { expired, reminders, summary, ...retention, emails }
    await finish(true, report)
    return report
  } catch (error) {
    await finish(false, { error: (error as Error).name })
    throw error
  }
}
