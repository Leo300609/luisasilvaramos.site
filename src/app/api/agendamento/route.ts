import { z } from 'zod'

import { createBooking, createBookingSchema } from '@/server/booking/create'
import { BookingError } from '@/server/booking/errors'
import { verifyQuote } from '@/server/booking/quote'
import { issueToken, TOKEN_VALID_AFTER_APPOINTMENT_DAYS } from '@/server/booking/tokens'
import { getDb } from '@/server/db/client'
import { setBookingCookie } from '@/server/http/booking-cookie'
import { badRequest, forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import { log } from '@/lib/observability/log'
import { bookingConfigured, getKeyRing, getSigningSecret } from '@/server/runtime'
import { addMinutes, localToInstant, timeToMinutes } from '@/server/scheduling/time'

const body = createBookingSchema.omit({ travel: true, address: true, source: true }).extend({
  quote: z.string().min(10).max(2000),
  policyAccepted: z.literal(true),
})

const STATUS: Record<BookingError['code'], number> = {
  'invalid-input': 400,
  'consent-required': 400,
  'service-unavailable': 422,
  'event-too-early': 422,
  'outside-window': 422,
  'slot-taken': 409,
  'too-many-pending': 429,
}

/** Creates a booking from the public flow. Everything is recomputed on the server. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.path.join('.')))

  const now = new Date()
  const { quote: quoteToken, policyAccepted: _accepted, ...input } = parsed.data
  const quote = verifyQuote(quoteToken, getSigningSecret(), now)
  if (!quote) return json({ error: 'quote-expired' }, { status: 422 })

  const db = getDb()
  try {
    const result = await createBooking(
      db,
      {
        ...input,
        address: {
          line: quote.addressLine,
          ...(quote.complement ? { complement: quote.complement } : {}),
        },
        travel: {
          feeCents: quote.feeCents,
          toMin: quote.toMin,
          backMin: quote.backMin,
          distanceKm: quote.distanceKm,
        },
        source: 'site',
      },
      { now, keyRing: getKeyRing() },
    )
    const appointment = localToInstant(input.date, timeToMinutes(input.time))
    const { token, expiresAt } = await issueToken(
      db,
      result.id,
      addMinutes(appointment, TOKEN_VALID_AFTER_APPOINTMENT_DAYS * 24 * 60),
    )
    await setBookingCookie(token, expiresAt)
    log.info('booking.created', {
      bookingId: result.id,
      replayed: result.replayed,
      status: result.status,
    })
    return json(
      { code: result.code, status: result.status },
      { status: result.replayed ? 200 : 201 },
    )
  } catch (error) {
    if (error instanceof BookingError) {
      return json({ error: error.code, message: error.message }, { status: STATUS[error.code] })
    }
    log.error('booking.create_failed', { error })
    return json({ error: 'internal' }, { status: 500 })
  }
}
