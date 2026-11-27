/**
 * "Perdi o link": e-mails a fresh "Minha agenda" link to the address on file.
 * The caller always answers the same thing, whether or not the address exists
 * (no account enumeration), and the actual send happens after the response.
 */
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm'

import * as schema from '../db/schema'
import { enqueueEmail } from '../email/enqueue'
import type { Db } from '../scheduling/context'
import { addMinutes } from '../scheduling/time'

/** At most this many link e-mails per customer per hour… */
export const ACCESS_LINK_PER_HOUR = 3
/** …and never two within this many minutes (double clicks, scripted retries). */
export const ACCESS_LINK_COOLDOWN_MIN = 2

export async function requestAccessLink(db: Db, rawEmail: string, now: Date): Promise<number> {
  const email = rawEmail.trim().toLowerCase()
  const customers = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(and(eq(schema.customers.email, email), isNull(schema.customers.anonymizedAt)))

  let queued = 0
  for (const { id } of customers) {
    const [active] = await db
      .select({ n: count() })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.customerId, id),
          sql`${schema.bookings.status} in ('pendente', 'confirmado')`,
          gte(schema.bookings.endsAt, now),
        ),
      )
    if (!active?.n) continue

    const recent = await db
      .select({ createdAt: schema.emailOutbox.createdAt })
      .from(schema.emailOutbox)
      .where(
        and(
          eq(schema.emailOutbox.customerId, id),
          eq(schema.emailOutbox.kind, 'access_link'),
          gte(schema.emailOutbox.createdAt, addMinutes(now, -60)),
        ),
      )
    const cooldown = addMinutes(now, -ACCESS_LINK_COOLDOWN_MIN)
    if (recent.length >= ACCESS_LINK_PER_HOUR || recent.some((r) => r.createdAt > cooldown)) {
      continue
    }
    // created_at is pinned to `now`, the same clock the throttle above reads.
    await enqueueEmail(db, {
      kind: 'access_link',
      recipient: 'cliente',
      customerId: id,
      dedupeKey: `access_link:${id}:${now.getTime()}`,
      createdAt: now,
    })
    queued += 1
  }
  return queued
}
