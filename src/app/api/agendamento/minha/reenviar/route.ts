import { LIMITS } from '@/server/http/rate-limit'
import { z } from 'zod'

import { requestAccessLink } from '@/server/booking/access'
import { getDb } from '@/server/db/client'
import { deliverEmailsAfterResponse } from '@/server/email/dispatch'
import { badRequest, forbidden, isSameOrigin, json, unavailable } from '@/server/http/guards'
import { log } from '@/lib/observability/log'
import { bookingConfigured, limitRequest } from '@/server/runtime'

const body = z.object({ email: z.email().max(200) })

/**
 * "Reenviar meu link". Always answers 202 with the same body, whether or not the
 * address has a booking, so it cannot be used to find out who booked.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()
  if (!bookingConfigured()) return unavailable()
  const limited = await limitRequest(request, LIMITS.resend)
  if (limited) return limited
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return badRequest()
  try {
    const queued = await requestAccessLink(getDb(), parsed.data.email, new Date())
    if (queued) deliverEmailsAfterResponse()
  } catch (error) {
    log.error('access_link.request_failed', { error })
  }
  return json({ ok: true }, { status: 202 })
}
