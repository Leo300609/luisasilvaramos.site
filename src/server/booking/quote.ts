/**
 * Address → travel quote. The browser sends CEP + number; the server looks the
 * address up, estimates the route from the Luísa's base and returns a SIGNED
 * quote. Creating a booking requires that signature, so the fee and travel time
 * can never be edited by the client.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

import { decryptField, type KeyRing } from '../crypto/fields'
import { loadConfig, type Db } from '../scheduling/context'
import { quoteTravel, type GeoPoint, type RouteProvider } from '../scheduling/travel'

export type AddressLookup = {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  location?: GeoPoint
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const onlyDigits = (v: string) => v.replace(/\D/g, '')

/**
 * CEP lookup on BrasilAPI (v2 returns coordinates for most CEPs). Times out fast;
 * the UI then lets the client type the address and the Luísa confirms by WhatsApp.
 */
export async function lookupCep(
  cep: string,
  fetcher: Fetcher = fetch,
): Promise<AddressLookup | null> {
  const digits = onlyDigits(cep)
  if (digits.length !== 8) return null
  try {
    const response = await fetcher(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      cep?: string
      street?: string
      neighborhood?: string
      city?: string
      state?: string
      location?: { coordinates?: { latitude?: string; longitude?: string } }
    }
    const lat = Number(data.location?.coordinates?.latitude)
    const lng = Number(data.location?.coordinates?.longitude)
    return {
      cep: digits,
      street: data.street ?? '',
      neighborhood: data.neighborhood ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
      ...(Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0
        ? { location: { lat, lng } }
        : {}),
    }
  } catch {
    return null
  }
}

export type SignedQuote = {
  addressLine: string
  complement?: string
  feeCents: number
  toMin: number
  backMin: number
  distanceKm: number
  /** Unix ms. Quotes expire so fee changes apply to new bookings. */
  exp: number
}

export function signQuote(quote: SignedQuote, secret: string): string {
  const payload = Buffer.from(JSON.stringify(quote)).toString('base64url')
  const mac = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

export function verifyQuote(token: string, secret: string, now: Date): SignedQuote | null {
  const [payload, mac] = token.split('.')
  if (!payload || !mac) return null
  const expected = createHmac('sha256', secret).update(payload).digest()
  const given = Buffer.from(mac, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const quote = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedQuote
    return quote.exp > now.getTime() ? quote : null
  } catch {
    return null
  }
}

export type QuoteResult =
  | { ok: true; quote: SignedQuote; token: string; address: AddressLookup }
  | {
      ok: false
      reason: 'cep-not-found' | 'no-coordinates' | 'out-of-radius' | 'base-not-configured'
    }

export type CepLookup = (cep: string) => Promise<AddressLookup | null>

/**
 * Deterministic lookup for automated tests and local development only
 * (FAKE_EXTERNAL_SERVICES=1, refused in production by src/server/runtime.ts).
 * CEP 99999-999 simulates "not found"; 88888-888 simulates "far away".
 */
export const fakeCepLookup: CepLookup = async (cep) => {
  const digits = onlyDigits(cep)
  if (digits === '99999999') return null
  const far = digits === '88888888'
  return {
    cep: digits,
    street: 'Rua de Teste',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    location: far ? { lat: -22.9068, lng: -43.1729 } : { lat: -23.5614, lng: -46.6559 },
  }
}

export async function quoteForAddress(
  db: Db,
  input: { cep: string; number: string; complement?: string },
  deps: {
    keyRing: KeyRing
    routes: RouteProvider
    secret: string
    now: Date
    lookup?: CepLookup
    fetcher?: Fetcher
  },
): Promise<QuoteResult> {
  const config = await loadConfig(db)
  const base = await loadBaseLocation(db, deps.keyRing)
  if (!base) return { ok: false, reason: 'base-not-configured' }

  const address = deps.lookup
    ? await deps.lookup(input.cep)
    : await lookupCep(input.cep, deps.fetcher)
  if (!address) return { ok: false, reason: 'cep-not-found' }
  if (!address.location) return { ok: false, reason: 'no-coordinates' }

  const route = await deps.routes.route(base, address.location)
  const travel = quoteTravel(route, config.travel)
  if (!travel.withinRadius) return { ok: false, reason: 'out-of-radius' }

  const addressLine = [
    `${address.street}, ${input.number.trim()}`,
    address.neighborhood,
    `${address.city}/${address.state}`,
    `CEP ${address.cep.slice(0, 5)}-${address.cep.slice(5)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const quote: SignedQuote = {
    addressLine,
    ...(input.complement?.trim() ? { complement: input.complement.trim() } : {}),
    feeCents: travel.feeCents,
    toMin: travel.toMin,
    backMin: travel.backMin,
    distanceKm: travel.distanceKm,
    exp: deps.now.getTime() + 2 * 60 * 60 * 1000,
  }
  return { ok: true, quote, token: signQuote(quote, deps.secret), address }
}

async function loadBaseLocation(db: Db, keyRing: KeyRing): Promise<GeoPoint | null> {
  const row = await db.query.scheduleSettings.findFirst({ columns: { baseLocationEnc: true } })
  if (!row?.baseLocationEnc) return null
  const point = JSON.parse(
    decryptField(row.baseLocationEnc, keyRing, 'schedule_settings.base_location'),
  ) as GeoPoint
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) ? point : null
}
