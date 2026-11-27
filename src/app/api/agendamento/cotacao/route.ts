import { z } from 'zod'

import { quoteForAddress } from '@/server/booking/quote'
import { getDb } from '@/server/db/client'
import { badRequest, forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import {
  bookingConfigured,
  getCepLookup,
  getKeyRing,
  getRouteProvider,
  getSigningSecret,
} from '@/server/runtime'

const body = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(200).optional(),
})

/** CEP + number → signed travel quote (fee, travel time, formatted address). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest()

  const result = await quoteForAddress(getDb(), parsed.data, {
    keyRing: getKeyRing(),
    routes: getRouteProvider(),
    secret: getSigningSecret(),
    now: new Date(),
    lookup: getCepLookup(),
  })
  if (!result.ok) return json({ error: result.reason }, { status: 422 })
  return json({
    token: result.token,
    addressLine: result.quote.addressLine,
    complement: result.quote.complement ?? null,
    feeCents: result.quote.feeCents,
    travelMin: result.quote.toMin,
    distanceKm: result.quote.distanceKm,
  })
}
