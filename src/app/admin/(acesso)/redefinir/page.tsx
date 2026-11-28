import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'

import { AlertIcon } from '@/components/admin/icons'
import { resetTokenValid } from '@/server/auth/service'
import { getDb } from '@/server/db/client'
import { adminConfigured } from '@/server/runtime'

import { RESET_COOKIE } from '../reset-cookie'
import { ResetForm } from './reset-form'

export const metadata: Metadata = { title: 'Nova senha' }

export default async function ResetPage() {
  const token = (await cookies()).get(RESET_COOKIE)?.value
  const valid =
    adminConfigured() && token ? await resetTokenValid(getDb(), token, new Date()) : false
  if (!valid) {
    return (
      <div className="adm-form">
        <h1 className="adm-title">Link inválido</h1>
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>Esse link expirou ou já foi usado.</strong> Peça um novo para redefinir a senha.
          </span>
        </div>
        <Link href="/admin/recuperar" className="adm-btn adm-btn-gold">
          Pedir novo link
        </Link>
      </div>
    )
  }
  return <ResetForm />
}
