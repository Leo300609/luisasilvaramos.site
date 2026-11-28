import { LIMITS } from '@/server/http/rate-limit'
import { z } from 'zod'

import { slotsForReschedule } from '@/server/booking/manage'
import { getDb } from '@/server/db/client'
import { bookingFromCookie } from '@/server/http/booking-cookie'
import { badRequest, forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import { bookingConfigured, limitRequest } from '@/server/runtime'

const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

/** Free slots for rescheduling the visitor's own booking (its current range is ignored). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const limited = await limitRequest(request, LIMITS.slots)
  if (limited) return limited
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest()
  const db = getDb()
  const now = new Date()
  const bookingId = await bookingFromCookie(db, now)
  if (!bookingId) return json({ error: 'not-found' }, { status: 404 })
  const slots = await slotsForReschedule(db, bookingId, parsed.data.date, { now })
  return json({ slots: slots.map((s) => ({ time: s.time, fit: s.fit })) })
}
