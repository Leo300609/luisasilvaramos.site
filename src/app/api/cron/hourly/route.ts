import { timingSafeEqual } from 'node:crypto'

import { env } from '@/env/server'
import { log } from '@/lib/observability/log'
import { getDb } from '@/server/db/client'
import { runHourly } from '@/server/jobs/hourly'
import { bookingConfigured, emailDeliveryDeps } from '@/server/runtime'

export const maxDuration = 60

function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * Called every hour by the Netlify scheduled function (netlify/functions/hourly.mts).
 * Not public: requires the CRON_SECRET bearer; anything else gets a bare 404.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return new Response('Not found', { status: 404 })
  if (!bookingConfigured()) return Response.json({ skipped: 'not-configured' })
  try {
    const report = await runHourly(getDb(), emailDeliveryDeps(new Date()))
    log.info('job.hourly', report)
    return Response.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    log.error('job.hourly_failed', { error })
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
