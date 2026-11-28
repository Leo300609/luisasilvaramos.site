'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { log } from '@/lib/observability/log'
import {
  clearAdminCookie,
  adminToken,
  authDeps,
  clientInfo,
  setAdminCookie,
} from '@/server/admin/session'
import {
  confirmTotpEnrollment,
  loginWithPassword,
  requestPasswordReset,
  resetPassword,
  verifySecondFactor,
} from '@/server/auth/service'
import { getDb } from '@/server/db/client'
import { deliverEmailsAfterResponse } from '@/server/email/dispatch'
import { adminConfigured } from '@/server/runtime'

import { RESET_COOKIE } from './reset-cookie'
import { cookies } from 'next/headers'

export type LoginState = { error?: 'invalid' | 'locked' | 'unavailable'; email?: string }

const loginSchema = z.object({
  email: z.string().trim().max(200),
  password: z.string().min(1).max(256),
  remember: z.literal('on').optional(),
})

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
    remember: form.get('remember') ?? undefined,
  })
  const email = String(form.get('email') ?? '').slice(0, 200)
  if (!parsed.success) return { error: 'invalid', email }
  if (!adminConfigured()) return { error: 'unavailable', email }

  const result = await loginWithPassword(
    getDb(),
    { email: parsed.data.email, password: parsed.data.password, remember: !!parsed.data.remember },
    await clientInfo(),
    authDeps(),
  )
  if (result.kind !== 'ok') return { error: result.kind, email }
  // Pending session: a browser-session cookie is enough for the next 10 minutes.
  await setAdminCookie(result.token, { expiresAt: result.expiresAt, persistent: false })
  redirect(result.needsEnrollment ? '/admin/configurar-2fa' : '/admin/verificar')
}

export type CodeState = { error?: 'invalid' | 'locked' | 'expired'; attemptsLeft?: number }

export async function verifyAction(_prev: CodeState, form: FormData): Promise<CodeState> {
  const code = String(form.get('code') ?? '').slice(0, 40)
  const result = await verifySecondFactor(
    getDb(),
    await adminToken(),
    code,
    await clientInfo(),
    authDeps(),
  )
  if (result.kind === 'invalid') return { error: 'invalid', attemptsLeft: result.attemptsLeft }
  if (result.kind !== 'ok') {
    await clearAdminCookie()
    return { error: result.kind }
  }
  await setAdminCookie(result.token, { expiresAt: result.expiresAt, persistent: result.remember })
  redirect('/admin')
}

export type EnrollState = { error?: 'invalid' | 'expired'; recoveryCodes?: string[] }

export async function enrollAction(_prev: EnrollState, form: FormData): Promise<EnrollState> {
  const code = String(form.get('code') ?? '').slice(0, 12)
  const result = await confirmTotpEnrollment(
    getDb(),
    await adminToken(),
    code,
    await clientInfo(),
    authDeps(),
  )
  if (result.kind !== 'ok') return { error: result.kind }
  await setAdminCookie(result.token, { expiresAt: result.expiresAt, persistent: result.remember })
  return { recoveryCodes: result.recoveryCodes }
}

export type RecoverState = { sent?: boolean }

export async function recoverAction(_prev: RecoverState, form: FormData): Promise<RecoverState> {
  const email = z
    .email()
    .max(200)
    .safeParse(String(form.get('email') ?? '').trim())
  if (email.success && adminConfigured()) {
    try {
      const queued = await requestPasswordReset(getDb(), email.data, await clientInfo(), authDeps())
      if (queued) deliverEmailsAfterResponse()
    } catch (error) {
      log.error('admin.reset_request_failed', { error })
    }
  }
  // Same answer whatever happened: no account enumeration.
  return { sent: true }
}

export type ResetState = { error?: 'weak' | 'mismatch' | 'invalid-token'; message?: string }

export async function resetAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const password = String(form.get('password') ?? '')
  if (password !== String(form.get('confirm') ?? '')) return { error: 'mismatch' }
  const store = await cookies()
  const token = store.get(RESET_COOKIE)?.value ?? ''
  const result = await resetPassword(getDb(), token, password, await clientInfo(), authDeps())
  if (result.kind === 'weak') return { error: 'weak', message: result.message }
  if (result.kind !== 'ok') return { error: 'invalid-token' }
  store.delete(RESET_COOKIE)
  await clearAdminCookie()
  redirect('/admin/entrar?senha=alterada')
}

export async function cancelLoginAction(): Promise<void> {
  await clearAdminCookie()
  redirect('/admin/entrar')
}
