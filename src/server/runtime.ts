import 'server-only'

import path from 'node:path'

import { env } from '@/env/server'

import { fakeCepLookup, lookupCep, type CepLookup } from './booking/quote'
import { parseKeyRing, type KeyRing } from './crypto/fields'
import { getDb } from './db/client'
import { FileMailer, ResendMailer, type Mailer } from './email/mailer'
import { clientIp, tooManyRequests } from './http/guards'
import { hit, type Limit } from './http/rate-limit'
import type { DeliveryDeps } from './email/outbox'
import { EstimatedRouteProvider, type RouteProvider } from './scheduling/travel'

let ring: KeyRing | undefined

/** Field-encryption keys; throws a clear error when not configured. */
export function getKeyRing(): KeyRing {
  ring ??= parseKeyRing(env.ENC_KEYS, env.ENC_ACTIVE_KEY)
  return ring
}

export function getSigningSecret(): string {
  if (!env.BOOKING_SIGNING_SECRET) throw new Error('BOOKING_SIGNING_SECRET is not configured.')
  return env.BOOKING_SIGNING_SECRET
}

/** Phase 4c swaps this for a real routing API, keeping the estimate as fallback. */
export function getRouteProvider(): RouteProvider {
  return new EstimatedRouteProvider()
}

/** True when everything the online booking needs is configured. */
export function bookingConfigured(): boolean {
  return Boolean(
    env.DATABASE_URL && env.ENC_KEYS && env.ENC_ACTIVE_KEY && env.BOOKING_SIGNING_SECRET,
  )
}

/** Real CEP lookup, or a deterministic fake for E2E tests (never in production). */
export function getCepLookup(): CepLookup {
  if (process.env.FAKE_EXTERNAL_SERVICES === '1') {
    if (env.APP_ENV === 'production')
      throw new Error('FAKE_EXTERNAL_SERVICES is not allowed in production')
    return fakeCepLookup
  }
  return (cep) => lookupCep(cep)
}

let mailer: Mailer | null | undefined

/**
 * E-mail transport: Resend when configured; in development and E2E tests, a
 * folder (`.emails/`) so links can be opened locally. `null` in a deployed
 * environment without a key: e-mails then wait in the outbox until it is set.
 */
export function getMailer(): Mailer | null {
  if (mailer !== undefined) return mailer
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    mailer = new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM)
  } else if (env.APP_ENV === 'local' || env.APP_ENV === 'test') {
    mailer = new FileMailer(path.join(process.cwd(), '.emails'))
  } else {
    mailer = null
  }
  return mailer
}

export function emailDeliveryDeps(now: Date): DeliveryDeps {
  return {
    mailer: getMailer(),
    keyRing: getKeyRing(),
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    adminEmail: env.EMAIL_ADMIN_NOTIFY ?? null,
    replyTo: env.EMAIL_REPLY_TO ?? null,
    now,
  }
}

/** True when the admin panel can run (database, encryption and AUTH_SECRET). */
export function adminConfigured(): boolean {
  return Boolean(env.DATABASE_URL && env.ENC_KEYS && env.ENC_ACTIVE_KEY && env.AUTH_SECRET)
}

export function getAuthSecret(): string {
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET is not configured.')
  return env.AUTH_SECRET
}

/**
 * Applies a public-API limit for this request's IP. Returns a 429 Response when
 * exceeded, or null to continue. Fails open if the limiter itself errors: a
 * database hiccup must not take bookings down.
 */
export async function limitRequest(request: Request, limit: Limit): Promise<Response | null> {
  // E2E runs book dozens of times from one IP; the limiter itself is covered by DB tests.
  if (process.env.FAKE_EXTERNAL_SERVICES === '1' && env.APP_ENV !== 'production') return null
  try {
    const r = await hit(getDb(), limit, clientIp(request), getSigningSecret(), new Date())
    return r.ok ? null : tooManyRequests(r.retryAfterSec)
  } catch {
    return null
  }
}
