'use client'

import { useActionState } from 'react'

import { AlertIcon, Spinner } from '@/components/admin/icons'

import { resetAction, type ResetState } from '../actions'

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetAction, {})
  const message =
    state.error === 'mismatch'
      ? 'As duas senhas não são iguais.'
      : state.error === 'weak'
        ? state.message
        : state.error === 'invalid-token'
          ? 'Esse link expirou ou já foi usado. Peça um novo.'
          : null
  return (
    <form action={action} className="adm-form" aria-labelledby="t-reset">
      <div>
        <h1 id="t-reset" className="adm-title">
          Nova senha
        </h1>
        <p className="adm-sub" id="pw-help">
          Use pelo menos 12 caracteres. Uma frase com palavras soltas é fácil de lembrar e difícil
          de adivinhar.
        </p>
      </div>
      {message && (
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>{message}</strong>
          </span>
        </div>
      )}
      <div className="fl">
        <input
          id="n-senha"
          name="password"
          className="fl-input"
          type="password"
          placeholder=" "
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          aria-describedby="pw-help"
          aria-invalid={state.error === 'weak' || undefined}
        />
        <label htmlFor="n-senha" className="fl-label">
          Nova senha
        </label>
      </div>
      <div className="fl">
        <input
          id="n-confirma"
          name="confirm"
          className="fl-input"
          type="password"
          placeholder=" "
          autoComplete="new-password"
          required
          maxLength={128}
          aria-invalid={state.error === 'mismatch' || undefined}
        />
        <label htmlFor="n-confirma" className="fl-label">
          Repita a nova senha
        </label>
      </div>
      <button type="submit" className="adm-btn adm-btn-gold" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        Salvar nova senha
      </button>
    </form>
  )
}
