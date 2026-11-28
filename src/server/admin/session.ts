import 'server-only'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { env } from '@/env/server'

import { checkSession, type AuthDeps, type ClientInfo } from '../auth/service'
import { getDb } from '../db/client'
import type { AdminUser } from '../db/schema'
import { adminConfigured, getAuthSecret, getKeyRing } from '../runtime'

/**
 * `__Host-` prefix in production: the browser only accepts it with Secure,
 * Path=/ and no Domain, so a subdomain can never set or overwrite it.
 */
export const ADMIN_COOKIE = env.APP_ENV === 'production' ? '__Host-lsr_admin' : 'lsr_admin'

export function authDeps(now = new Date()): AuthDeps {
  return { now, keyRing: getKeyRing(), secret: getAuthSecret() }
}

/** Netlify sets x-nf-client-connection-ip; elsewhere the first X-Forwarded-For hop. */
export async function clientInfo(): Promise<ClientInfo> {
  const h = await headers()
  const ip =
    h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  return { ip, userAgent: h.get('user-agent') }
}

export async function setAdminCookie(
  token: string,
  opts: { expiresAt: Date; persistent: boolean },
) {
  const store = await cookies()
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: env.APP_ENV === 'production' || process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    // Without "manter conectada" the cookie ends with the browser (the server limit still applies).
    ...(opts.persistent ? { expires: opts.expiresAt } : {}),
  })
}

export async function clearAdminCookie() {
  ;(await cookies()).delete(ADMIN_COOKIE)
}

export async function adminToken(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value
}

export type AdminContext = { user: Pick<AdminUser, 'id' | 'email' | 'name'>; sessionId: string }

/**
 * Gate for every panel page and action. Redirects to the login (with the
 * "sessão expirada" banner when it was a real session). Cached per request.
 */
export const requireAdmin = cache(async (): Promise<AdminContext> => {
  if (!adminConfigured()) redirect('/admin/entrar')
  const token = await adminToken()
  const result = await checkSession(getDb(), token, new Date())
  if (result.status === 'valid') {
    return {
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      sessionId: result.session.id,
    }
  }
  if (result.status === 'pending') redirect('/admin/verificar')
  redirect(result.status === 'expired' ? '/admin/entrar?sessao=expirada' : '/admin/entrar')
})
