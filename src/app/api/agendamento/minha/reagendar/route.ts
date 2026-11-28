import { LIMITS } from '@/server/http/rate-limit'
import { z } from 'zod'

import { BookingError } from '@/server/booking/errors'
import { rescheduleByClient } from '@/server/booking/manage'
import { deliverEmailsAfterResponse } from '@/server/email/dispatch'
import { getDb } from '@/server/db/client'
import { bookingFromCookie } from '@/server/http/booking-cookie'
import { badRequest, forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import { bookingConfigured, limitRequest } from '@/server/runtime'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time,
  eventStart: time.optional(),
})

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const limited = await limitRequest(request, LIMITS.manage)
  if (limited) return limited
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest()
  const db = getDb()
  const now = new Date()
  const bookingId = await bookingFromCookie(db, now)
  if (!bookingId) return json({ error: 'not-found' }, { status: 404 })
  try {
    await rescheduleByClient(db, bookingId, parsed.data, { now })
    deliverEmailsAfterResponse()
    return json({ ok: true })
  } catch (error) {
    if (error instanceof BookingError) {
      return json(
        { error: error.code, message: error.message },
        { status: error.code === 'slot-taken' ? 409 : 422 },
      )
    }
    throw error
  }
}
