import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { verifyQuote } from '@/server/booking/quote'
import { getDb } from '@/server/db/client'
import * as schema from '@/server/db/schema'
import { badRequest, forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import { bookingConfigured, getSigningSecret } from '@/server/runtime'
import {
  findNextAvailableDays,
  getDaySlots,
  getMonthAvailability,
} from '@/server/scheduling/context'
import { addDays } from '@/server/scheduling/time'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const body = z.object({
  serviceId: z.number().int().positive(),
  quote: z.string().min(10).max(2000),
  eventStart: time,
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

/**
 * Availability for the booking calendar. POST (not GET) so the signed quote,
 * which carries the address, never ends up in URLs or access logs.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success || (!parsed.data.month && !parsed.data.date)) return badRequest()
  const input = parsed.data
  const now = new Date()
  const quote = verifyQuote(input.quote, getSigningSecret(), now)
  if (!quote) return json({ error: 'quote-expired' }, { status: 422 })

  const db = getDb()
  const service = await db.query.services.findFirst({
    where: and(eq(schema.services.id, input.serviceId), eq(schema.services.active, true)),
  })
  if (!service) return json({ error: 'service-unavailable' }, { status: 422 })
  const travel = { toMin: quote.toMin, backMin: quote.backMin }

  if (input.month) {
    const days = await getMonthAvailability(db, {
      month: input.month,
      now,
      durationMin: service.durationMin,
      travel,
      eventStart: input.eventStart,
    })
    return json({ days })
  }

  const date = input.date!
  const slots = await getDaySlots(db, {
    date,
    now,
    durationMin: service.durationMin,
    travel,
    eventStart: input.eventStart,
  })
  const suggestions = slots.length
    ? []
    : (
        await findNextAvailableDays(db, {
          after: date,
          count: 3,
          now,
          durationMin: service.durationMin,
          travel,
        })
      ).map((d) => d.date)
  return json({
    date,
    slots: slots.map((s) => ({ time: s.time, fit: s.fit })),
    suggestions,
    nextDay: addDays(date, 1),
  })
}
