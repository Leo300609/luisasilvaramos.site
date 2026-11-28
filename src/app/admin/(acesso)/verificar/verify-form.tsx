'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { AlertIcon, LockIcon, ShieldIcon, Spinner } from '@/components/admin/icons'

import { cancelLoginAction, verifyAction, type CodeState } from '../actions'

export function VerifyForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyAction, {})
  const [recovery, setRecovery] = useState(false)
  const ended = state.error === 'locked' || state.error === 'expired'

  if (ended) {
    return (
      <div className="adm-form">
        <div role="alert" className="adm-alert adm-alert-error">
          <LockIcon />
          <span>
            <strong>{state.error === 'locked' ? 'Muitas tentativas.' : 'O tempo acabou.'}</strong>{' '}
            Por segurança, entre de novo com e-mail e senha.
          </span>
        </div>
        <Link href="/admin/entrar" className="adm-btn adm-btn-gold">
          Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="adm-form" aria-labelledby="t-2fa">
      <span className="adm-icon-badge">
        <ShieldIcon size={28} />
      </span>
      <div>
        <h1 id="t-2fa" className="adm-title">
          Verificação em 2 etapas
        </h1>
        <p className="adm-sub" id="code-help">
          {recovery
            ? 'Digite um dos códigos de recuperação que você guardou (ex.: abcde-fghij). Cada um vale uma vez.'
            : 'Abra o app autenticador no seu celular e digite o código de 6 dígitos de “Luísa Silva Ramos”.'}
        </p>
      </div>

      {state.error === 'invalid' && (
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>Código inválido.</strong>{' '}
            {state.attemptsLeft === 1
              ? 'Resta 1 tentativa.'
              : `Restam ${state.attemptsLeft} tentativas.`}
          </span>
        </div>
      )}

      <label htmlFor="code" className="sr-only">
        {recovery ? 'Código de recuperação' : 'Código de 6 dígitos'}
      </label>
      <input
        key={recovery ? 'recovery' : 'totp'}
        id="code"
        name="code"
        className={`adm-otp${recovery ? 'is-recovery' : ''}`}
        type="text"
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        pattern={recovery ? undefined : '[0-9]{6}'}
        maxLength={recovery ? 11 : 6}
        required
        autoFocus
        spellCheck={false}
        autoCapitalize="none"
        aria-describedby="code-help"
        aria-invalid={state.error === 'invalid' || undefined}
      />

      <button type="submit" className="adm-btn adm-btn-gold" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        Verificar e entrar
      </button>
      <div className="adm-row">
        <button type="button" className="adm-link" onClick={() => setRecovery((v) => !v)}>
          {recovery ? 'Usar o app autenticador' : 'Perdi o celular: usar código de recuperação'}
        </button>
        <button
          type="submit"
          formAction={cancelLoginAction}
          formNoValidate
          className="adm-link is-muted"
        >
          Usar outra conta
        </button>
      </div>
    </form>
  )
}
