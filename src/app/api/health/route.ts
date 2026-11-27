import { env } from '@/env/server'

export const dynamic = 'force-dynamic'

/**
 * Shallow health check for the external uptime monitor.
 * It deliberately does NOT touch the database: pinging Neon every few minutes
 * would keep it awake and burn the free compute quota (see ADR 0007).
 */
export function GET() {
  return Response.json(
    {
      status: 'ok',
      env: env.APP_ENV,
      commit: env.COMMIT_REF ?? 'local',
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
