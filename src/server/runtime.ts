import 'server-only'

import { env } from '@/env/server'

import { fakeCepLookup, lookupCep, type CepLookup } from './booking/quote'
import { parseKeyRing, type KeyRing } from './crypto/fields'
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
