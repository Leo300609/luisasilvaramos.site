/**
 * Netlify Scheduled Function: every hour, asks the app to run its jobs
 * (expire pending requests, reminders, daily summary, e-mail retries, LGPD
 * retention). Scheduled functions only run on the published production deploy.
 * Docs: docs/adr/0007-tarefas-agendadas.md, docs/runbook.md.
 */
export default async () => {
  const base = process.env.URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    console.log('hourly: URL or CRON_SECRET missing, skipped')
    return
  }
  const response = await fetch(new URL('/api/cron/hourly', base), {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  })
  console.log(`hourly: HTTP ${response.status}`)
}

export const config = { schedule: '@hourly' }
