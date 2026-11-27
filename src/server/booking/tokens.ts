/**
 * "Minha agenda" access links (docs/adr/0008-tokens-cliente.md).
 * 256-bit random tokens; the database only stores their SHA-256, so a database
 * leak does not expose usable links. The booking code (LSR-0001) is never enough.
 */
import { createHash, randomBytes } from 'node:crypto'

import { and, eq, gt, isNull } from 'drizzle-orm'

import * as schema from '../db/schema'
import type { Db } from '../scheduling/context'

export const BOOKING_COOKIE = 'lsr_minha_agenda'
/** Links stay valid this long after the appointment (to see history, add to calendar). */
export const TOKEN_VALID_AFTER_APPOINTMENT_DAYS = 30

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export async function issueToken(
  db: Db,
  bookingId: string,
  expiresAt: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  await db
    .insert(schema.bookingTokens)
    .values({ bookingId, tokenHash: hashToken(token), expiresAt })
  return { token, expiresAt }
}

/** Returns the booking id for a valid, unexpired, unrevoked token; null otherwise. */
export async function resolveToken(db: Db, token: string, now: Date): Promise<string | null> {
  if (!isWellFormedToken(token)) return null
  const [row] = await db
    .update(schema.bookingTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(schema.bookingTokens.tokenHash, hashToken(token)),
        isNull(schema.bookingTokens.revokedAt),
        gt(schema.bookingTokens.expiresAt, now),
      ),
    )
    .returning({ bookingId: schema.bookingTokens.bookingId })
  return row?.bookingId ?? null
}

export async function revokeTokens(db: Db, bookingId: string, now: Date): Promise<void> {
  await db
    .update(schema.bookingTokens)
    .set({ revokedAt: now })
    .where(
      and(eq(schema.bookingTokens.bookingId, bookingId), isNull(schema.bookingTokens.revokedAt)),
    )
}
