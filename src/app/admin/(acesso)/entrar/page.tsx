import type { Metadata } from 'next'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sessao?: string; senha?: string }>
}) {
  const params = await searchParams
  return (
    <LoginForm
      notice={
        params.sessao === 'expirada'
          ? 'expired'
          : params.senha === 'alterada'
            ? 'password-changed'
            : null
      }
    />
  )
}
