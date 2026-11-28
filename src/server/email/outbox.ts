/**
 * Transactional outbox (docs/adr/0006-email.md).
 *
 * - `enqueueEmail` (./enqueue.ts) runs inside the business transaction, so an
 *   e-mail exists if and only if the change it announces was committed.
 * - `deliverDueEmails` claims due rows (SKIP LOCKED: concurrent runs never send
 *   the same row twice), renders them from current data and sends. Failures
 *   are retried with exponential backoff; permanent ones stop at once.
 */
import { and, count, eq, gte, inArray, sql } from 'drizzle-orm'

import { whatsappLink } from '@/lib/contact'

import { decryptField, type KeyRing } from '../crypto/fields'
import { loadAgenda } from '../admin/agenda'
import * as schema from '../db/schema'
import { getClientBooking, type ClientBookingView } from '../booking/manage'
import { issueToken, TOKEN_VALID_AFTER_APPOINTMENT_DAYS } from '../booking/tokens'
import type { Db } from '../scheduling/context'
import { addMinutes, instantToLocal, minutesToTime } from '../scheduling/time'
import { formatDateLong } from '@/lib/format'
import type { RenderedEmail } from './layout'
import { MailerError, type Mailer } from './mailer'
import * as t from './templates'
import { issuePasswordResetToken, POLICY } from '../auth/service'

export { enqueueEmail, EMAIL_KINDS, type EmailKind, type Recipient } from './enqueue'

/** Minutes to wait after the n-th failed attempt. */
export const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 360] as const
export const MAX_ATTEMPTS = RETRY_BACKOFF_MIN.length + 1
/** Messages older than this are discarded instead of sent late (e.g. after a long outage). */
export const STALE_AFTER_HOURS = 72
const CLAIM_LEASE_MIN = 5

export type DeliveryDeps = {
  mailer: Mailer | null
  keyRing: KeyRing
  siteUrl: string
  adminEmail: string | null
  replyTo?: string | null
  now: Date
}

export type DeliveryReport = { sent: number; retried: number; failed: number; discarded: number }

type Row = typeof schema.emailOutbox.$inferSelect

/** Raised by composers when the message should not be sent at all. */
class Discard extends Error {}

function summaryOf(v: ClientBookingView): t.BookingSummary {
  return {
    code: v.code,
    status: v.status,
    serviceName: v.serviceName,
    durationMin: v.durationMin,
    date: v.date,
    time: v.time,
    endTime: v.endTime,
    eventStart: v.eventStart,
    eventDuration: v.eventDuration,
    address: v.address,
    complement: v.complement,
    priceCents: v.priceCents,
    travelFeeCents: v.travelFeeCents,
    totalCents: v.totalCents,
    changeDeadline: v.changeDeadline,
  }
}

/** "terça-feira, 15 de dezembro de 2026, às 09:00" from an ISO instant. */
function localLabel(iso: string): string {
  const { date, minutes } = instantToLocal(new Date(iso))
  return `${formatDateLong(date)}, às ${minutesToTime(minutes)}`
}

async function accessLink(db: Db, deps: DeliveryDeps, view: ClientBookingView): Promise<string> {
  const { token } = await issueToken(
    db,
    view.id,
    addMinutes(new Date(view.startsAt), TOKEN_VALID_AFTER_APPOINTMENT_DAYS * 24 * 60),
  )
  return new URL(`/a/${token}`, deps.siteUrl).toString()
}

async function compose(
  db: Db,
  row: Row,
  deps: DeliveryDeps,
): Promise<{ to: string; email: RenderedEmail }> {
  if (row.recipient === 'admin') {
    if (row.kind !== 'admin_password_reset' || !row.adminUserId)
      throw new Discard('bad-admin-email')
    const [user] = await db
      .select({
        email: schema.adminUsers.email,
        name: schema.adminUsers.name,
        disabled: schema.adminUsers.disabledAt,
      })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, row.adminUserId))
    if (!user || user.disabled) throw new Discard('admin-gone')
    const token = await issuePasswordResetToken(db, row.adminUserId, deps.now)
    return {
      to: user.email,
      email: t.adminPasswordReset({
        name: user.name,
        link: new URL(`/admin/r/${token}`, deps.siteUrl).toString(),
        validMinutes: POLICY.resetTokenMin,
      }),
    }
  }

  const to = row.recipient === 'luisa' ? deps.adminEmail : null

  if (row.kind === 'daily_summary') {
    if (!to) throw new Discard('no-admin-address')
    const date = String((row.data as { date?: string }).date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Discard('bad-date')
    const { items } = await loadAgenda(db, date, date)
    const rows = await Promise.all(
      items
        .filter((i) => i.status === 'confirmado')
        .map(async (i) => {
          const [raw] = await db
            .select({
              address: schema.bookings.addressEnc,
              allergy: schema.bookings.allergyNotesEnc,
            })
            .from(schema.bookings)
            .where(eq(schema.bookings.id, i.id))
          return {
            time: minutesToTime(i.startMin),
            leaveAt: minutesToTime(i.busyStartMin),
            name: i.customerName,
            serviceName: i.serviceName,
            address: raw?.address
              ? decryptField(raw.address, deps.keyRing, 'bookings.address')
              : '',
            eventStart: i.eventStart,
            hasAllergyNotes: Boolean(raw?.allergy),
          }
        }),
    )
    const [pending] = await db
      .select({ n: count() })
      .from(schema.bookings)
      .where(eq(schema.bookings.status, 'pendente'))
    return {
      to,
      email: t.adminDailySummary({
        date,
        items: rows,
        pending: pending?.n ?? 0,
        panelUrl: new URL('/admin', deps.siteUrl).toString(),
      }),
    }
  }
  if (row.recipient === 'luisa' && !to) throw new Discard('no-admin-address')

  const whatsappUrl = whatsappLink()
  const bookUrl = new URL('/agendar', deps.siteUrl).toString()

  if (row.kind === 'access_link') {
    if (!row.customerId) throw new Discard('missing-customer')
    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, row.customerId))
    if (!customer || customer.anonymizedAt) throw new Discard('customer-gone')
    const upcoming = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.customerId, customer.id),
          sql`${schema.bookings.status} in ('pendente', 'confirmado')`,
          gte(schema.bookings.endsAt, deps.now),
        ),
      )
      .orderBy(schema.bookings.startsAt)
      .limit(5)
    if (upcoming.length === 0) throw new Discard('no-upcoming-bookings')
    const bookings = []
    for (const { id } of upcoming) {
      const view = await getClientBooking(db, id, deps)
      if (view) bookings.push({ summary: summaryOf(view), link: await accessLink(db, deps, view) })
    }
    const info = { name: customer.name, phone: customer.phoneE164, email: customer.email }
    return { to: customer.email, email: t.clientAccessLink({ customer: info, bookings }) }
  }

  if (!row.bookingId) throw new Discard('missing-booking')
  const view = await getClientBooking(db, row.bookingId, deps)
  if (!view) throw new Discard('booking-gone')
  const b = summaryOf(view)
  const customer = view.customer
  const previous =
    typeof row.data === 'object' && row.data && 'from' in row.data
      ? localLabel(String((row.data as { from: unknown }).from))
      : ''

  if (row.recipient === 'cliente') {
    const email = customer.email
    // Bookings made in the panel may have no e-mail (phone-only clients).
    if (!email) throw new Discard('no-client-email')
    switch (row.kind) {
      case 'booking_created':
        if (!['pendente', 'confirmado'].includes(view.status)) throw new Discard('not-active')
        return {
          to: email,
          email: t.clientBookingCreated(b, {
            customer,
            link: await accessLink(db, deps, view),
            whatsappUrl,
            pendingExpiryHours: Number((row.data as { expiryHours?: number }).expiryHours ?? 24),
          }),
        }
      case 'booking_cancelled':
        return { to: email, email: t.clientBookingCancelled(b, { customer, bookUrl, whatsappUrl }) }
      case 'booking_confirmed':
        if (view.status !== 'confirmado') throw new Discard('not-confirmed')
        return {
          to: email,
          email: t.clientBookingCreated(b, {
            customer,
            link: await accessLink(db, deps, view),
            whatsappUrl,
            pendingExpiryHours: 0,
          }),
        }
      case 'booking_declined':
      case 'booking_expired':
        return { to: email, email: t.clientBookingDeclined(b, { customer, bookUrl, whatsappUrl }) }
      case 'booking_reminder':
        if (view.status !== 'confirmado') throw new Discard('not-confirmed')
        if (new Date(view.startsAt) <= deps.now) throw new Discard('already-started')
        return {
          to: email,
          email: t.clientReminder(b, {
            customer,
            link: await accessLink(db, deps, view),
            whatsappUrl,
          }),
        }
      case 'booking_rescheduled':
        if (!['pendente', 'confirmado'].includes(view.status)) throw new Discard('not-active')
        return {
          to: email,
          email: t.clientBookingRescheduled(b, {
            customer,
            link: await accessLink(db, deps, view),
            previous,
            whatsappUrl,
          }),
        }
    }
  } else {
    switch (row.kind) {
      case 'booking_created': {
        const [raw] = await db
          .select({ allergy: schema.bookings.allergyNotesEnc })
          .from(schema.bookings)
          .where(eq(schema.bookings.id, view.id))
        const digits = customer.phone.replace(/\D/g, '')
        return {
          to: to!,
          email: t.adminBookingCreated(b, {
            customer,
            lookNotes: view.lookNotes,
            hasAllergyNotes: Boolean(raw?.allergy),
            whatsappToClient: whatsappLink(
              `Olá, ${customer.name.split(' ')[0]}! Aqui é a Luísa, sobre o seu agendamento ${view.code}.`,
              digits,
            ),
          }),
        }
      }
      case 'booking_cancelled':
        return { to: to!, email: t.adminBookingCancelled(b, { customer }) }
      case 'booking_rescheduled':
        return { to: to!, email: t.adminBookingRescheduled(b, { customer, previous }) }
    }
  }
  throw new Discard(`unknown-kind:${row.kind}`)
}

async function claimDue(db: Db, now: Date, limit: number): Promise<Row[]> {
  const lease = addMinutes(now, CLAIM_LEASE_MIN)
  const result = await db.execute<{ id: string }>(sql`
    update email_outbox set locked_until = ${lease}, attempts = attempts + 1
    where id in (
      select id from email_outbox
      where status = 'pendente' and next_attempt_at <= ${now}
        and (locked_until is null or locked_until <= ${now})
      order by next_attempt_at
      limit ${limit}
      for update skip locked
    )
    returning id`)
  const ids = result.rows.map((r) => r.id)
  if (ids.length === 0) return []
  return db.select().from(schema.emailOutbox).where(inArray(schema.emailOutbox.id, ids))
}

/** Sends every due e-mail (bounded by `limit`). Safe to run concurrently and repeatedly. */
export async function deliverDueEmails(
  db: Db,
  deps: DeliveryDeps,
  limit = 20,
): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, retried: 0, failed: 0, discarded: 0 }
  if (!deps.mailer) return report
  const rows = await claimDue(db, deps.now, limit)

  for (const row of rows) {
    const set = (values: Partial<Row>) =>
      db
        .update(schema.emailOutbox)
        .set({ lockedUntil: null, ...values })
        .where(eq(schema.emailOutbox.id, row.id))

    if (deps.now.getTime() - row.createdAt.getTime() > STALE_AFTER_HOURS * 3_600_000) {
      await set({ status: 'descartado', lastError: 'stale' })
      report.discarded += 1
      continue
    }
    try {
      const { to, email } = await compose(db, row, deps)
      const result = await deps.mailer.send({
        to,
        ...email,
        idempotencyKey: `lsr-${row.id}`,
        ...(row.recipient === 'cliente' && deps.replyTo ? { replyTo: deps.replyTo } : {}),
      })
      await set({
        status: 'enviado',
        sentAt: deps.now,
        providerMessageId: result.id,
        lastError: null,
      })
      report.sent += 1
    } catch (error) {
      if (error instanceof Discard) {
        await set({ status: 'descartado', lastError: error.message })
        report.discarded += 1
        continue
      }
      const permanent = error instanceof MailerError && error.permanent
      // Never store provider/exception text that could contain personal data.
      const reason = error instanceof MailerError ? error.message : (error as Error).name
      const backoff = RETRY_BACKOFF_MIN[row.attempts - 1]
      if (permanent || backoff === undefined) {
        await set({ status: 'falhou', lastError: reason })
        report.failed += 1
      } else {
        await set({ lastError: reason, nextAttemptAt: addMinutes(deps.now, backoff) })
        report.retried += 1
      }
    }
  }
  return report
}
