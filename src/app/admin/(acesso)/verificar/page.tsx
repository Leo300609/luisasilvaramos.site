import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { adminToken } from '@/server/admin/session'
import { checkSession } from '@/server/auth/service'
import { getDb } from '@/server/db/client'
import { adminConfigured } from '@/server/runtime'

import { VerifyForm } from './verify-form'

export const metadata: Metadata = { title: 'Verificação em 2 etapas' }

export default async function VerifyPage() {
  if (!adminConfigured()) redirect('/admin/entrar')
  const check = await checkSession(getDb(), await adminToken(), new Date())
  if (check.status === 'valid') redirect('/admin')
  if (check.status !== 'pending') redirect('/admin/entrar?sessao=expirada')
  if (!check.user.totpEnabledAt) redirect('/admin/configurar-2fa')
  return <VerifyForm />
}
