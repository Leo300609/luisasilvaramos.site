import { LIMITS } from '@/server/http/rate-limit'
import { BookingError } from '@/server/booking/errors'
import { cancelByClient } from '@/server/booking/manage'
import { deliverEmailsAfterResponse } from '@/server/email/dispatch'
import { getDb } from '@/server/db/client'
import { bookingFromCookie } from '@/server/http/booking-cookie'
import { forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import { bookingConfigured, limitRequest } from '@/server/runtime'

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const limited = await limitRequest(request, LIMITS.manage)
  if (limited) return limited
  const db = getDb()
  const now = new Date()
  const bookingId = await bookingFromCookie(db, now)
  if (!bookingId) return json({ error: 'not-found' }, { status: 404 })
  try {
    await cancelByClient(db, bookingId, { now })
    deliverEmailsAfterResponse()
    return json({ ok: true })
  } catch (error) {
    if (error instanceof BookingError)
      return json({ error: error.code, message: error.message }, { status: 422 })
    throw error
  }
}
