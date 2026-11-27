import 'server-only'

import path from 'node:path'

import { env } from '@/env/server'

import { fakeCepLookup, lookupCep, type CepLookup } from './booking/quote'
import { parseKeyRing, type KeyRing } from './crypto/fields'
import { FileMailer, ResendMailer, type Mailer } from './email/mailer'
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
