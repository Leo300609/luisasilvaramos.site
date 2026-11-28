/**
 * Per-IP limits for the public API (docs/adr/0010-rate-limit-antibot.md).
 * Fixed windows counted in Postgres with one upsert per request: no extra
 * service to run or pay for. IPs are stored only as an HMAC.
 */
import { sql } from 'drizzle-orm'

import { hashIdentifier } from '../auth/audit'
import * as schema from '../db/schema'
import type { Db } from '../scheduling/context'

export type Limit = { name: string; max: number; windowSec: number }

export const LIMITS = {
  quote: { name: 'quote', max: 20, windowSec: 600 },
  slots: { name: 'slots', max: 150, windowSec: 600 },
  book: { name: 'book', max: 8, windowSec: 3600 },
  manage: { name: 'manage', max: 30, windowSec: 3600 },
  resend: { name: 'resend', max: 5, windowSec: 3600 },
} as const satisfies Record<string, Limit>

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number }

export async function hit(
  db: Db,
  limit: Limit,
  identifier: string,
  secret: string,
  now: Date,
): Promise<LimitResult> {
  const windowMs = limit.windowSec * 1000
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs)
  const key = `${limit.name}:${hashIdentifier(identifier, secret)}`
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { count: sql`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count })
  if ((row?.count ?? 0) <= limit.max) return { ok: true }
  const retryAfterSec = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
  )
  return { ok: false, retryAfterSec }
}
