import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { renderSVG } from 'uqr'

import { adminToken, authDeps } from '@/server/admin/session'
import { beginTotpEnrollment, checkSession } from '@/server/auth/service'
import { otpauthUri } from '@/server/auth/totp'
import { getDb } from '@/server/db/client'
import { adminConfigured } from '@/server/runtime'

import { EnrollForm } from './enroll-form'

export const metadata: Metadata = { title: 'Configurar verificação em 2 etapas' }

export default async function EnrollPage() {
  if (!adminConfigured()) redirect('/admin/entrar')
  const db = getDb()
  const token = await adminToken()
  const check = await checkSession(db, token, new Date())
  // Right after the setup the session becomes valid and this page re-renders: keep the same
  // component so its state (the recovery codes, shown once) survives the refresh.
  if (check.status === 'valid') return <EnrollForm qrSvg="" secret="" alreadyEnabled />
  if (check.status !== 'pending') redirect('/admin/entrar?sessao=expirada')
  if (check.user.totpEnabledAt) redirect('/admin/verificar')

  const setup = await beginTotpEnrollment(db, token, authDeps())
  if (!setup) redirect('/admin/entrar?sessao=expirada')
  const uri = otpauthUri(setup.secret, setup.email, 'Luísa Silva Ramos')
  // Generated on the server: the secret never goes to a third-party QR service.
  const qr = renderSVG(uri, { border: 1 })
  const grouped = setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret
  return <EnrollForm qrSvg={qr} secret={grouped} />
}
