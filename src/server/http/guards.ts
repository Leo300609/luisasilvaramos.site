import { env } from '@/env/server'

/**
 * CSRF defence for JSON endpoints: state-changing requests must come from our own
 * origin (cookies are also SameSite=Lax). Route Handlers, unlike Server Actions,
 * do not check this automatically.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const allowed = new Set([new URL(env.NEXT_PUBLIC_SITE_URL).origin])
  const host = request.headers.get('host')
  if (host) {
    allowed.add(`https://${host}`)
    if (env.APP_ENV !== 'production') allowed.add(`http://${host}`)
  }
  return allowed.has(origin)
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init.headers ?? {}) },
  })
}

export const forbidden = () => json({ error: 'forbidden' }, { status: 403 })
export const badRequest = (detail?: unknown) =>
  json({ error: 'invalid-input', detail }, { status: 400 })
export const unavailable = () => json({ error: 'not-configured' }, { status: 503 })
