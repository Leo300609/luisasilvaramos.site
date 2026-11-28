'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { BackIcon, CheckCircleIcon, Spinner } from '@/components/admin/icons'

import { recoverAction, type RecoverState } from '../actions'

export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(recoverAction, {})
  return (
    <form action={action} className="adm-form" aria-labelledby="t-rec">
      <div>
        <h1 id="t-rec" className="adm-title">
          Recuperar senha
        </h1>
        <p className="adm-sub">
          Informe o e-mail da administração. Enviaremos um link para criar uma nova senha.
        </p>
      </div>
      {state.sent && (
        <div role="status" className="adm-alert adm-alert-ok">
          <CheckCircleIcon />
          <span>
            <strong>Link enviado!</strong> Se o e-mail estiver cadastrado, você recebe as instruções
            em alguns minutos. Confira também a caixa de spam.
          </span>
        </div>
      )}
      <div className="fl">
        <input
          id="r-email"
          name="email"
          className="fl-input"
          type="email"
          placeholder=" "
          autoComplete="email"
          required
          maxLength={200}
        />
        <label htmlFor="r-email" className="fl-label">
          E-mail
        </label>
      </div>
      <button type="submit" className="adm-btn adm-btn-gold" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        Enviar link
      </button>
      <Link href="/admin/entrar" className="adm-btn adm-btn-ghost">
        <BackIcon size={18} />
        Voltar ao login
      </Link>
    </form>
  )
}
