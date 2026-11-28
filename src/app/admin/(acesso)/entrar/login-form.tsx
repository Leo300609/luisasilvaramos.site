'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  LockIcon,
  Spinner,
} from '@/components/admin/icons'

import { loginAction, type LoginState } from '../actions'

export function LoginForm({ notice }: { notice: 'expired' | 'password-changed' | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {})
  const [shown, setShown] = useState(false)
  const invalid = state.error === 'invalid'

  return (
    <form action={action} className="adm-form" aria-labelledby="t-login">
      <div>
        <h1 id="t-login" className="adm-title">
          Entrar no painel
        </h1>
        <p className="adm-sub">Use o e-mail e a senha da administração.</p>
      </div>

      {state.error === 'invalid' && (
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>E-mail ou senha incorretos.</strong> Confira os dados e tente de novo.
          </span>
        </div>
      )}
      {state.error === 'locked' && (
        <div role="alert" className="adm-alert adm-alert-error">
          <LockIcon />
          <span>
            <strong>Muitas tentativas.</strong> Tente novamente em 5 minutos.
          </span>
        </div>
      )}
      {state.error === 'unavailable' && (
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>Painel ainda não configurado.</strong> Fale com o responsável técnico.
          </span>
        </div>
      )}
      {!state.error && notice === 'expired' && (
        <div role="status" className="adm-alert adm-alert-warn">
          <ClockIcon />
          <span>
            <strong>Sua sessão expirou.</strong> Por segurança, entre de novo para continuar.
          </span>
        </div>
      )}
      {!state.error && notice === 'password-changed' && (
        <div role="status" className="adm-alert adm-alert-ok">
          <CheckCircleIcon />
          <span>
            <strong>Senha alterada.</strong> Entre com a nova senha.
          </span>
        </div>
      )}

      <div className="fl">
        <input
          id="l-email"
          name="email"
          className="fl-input"
          type="email"
          placeholder=" "
          autoComplete="username"
          required
          maxLength={200}
          defaultValue={state.email}
          aria-invalid={invalid || undefined}
        />
        <label htmlFor="l-email" className="fl-label">
          E-mail
        </label>
      </div>
      <div className="fl">
        <input
          id="l-senha"
          name="password"
          className="fl-input"
          style={{ paddingRight: 60 }}
          type={shown ? 'text' : 'password'}
          placeholder=" "
          autoComplete="current-password"
          required
          maxLength={256}
          aria-invalid={invalid || undefined}
        />
        <label htmlFor="l-senha" className="fl-label">
          Senha
        </label>
        <button
          type="button"
          className="fl-toggle"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={shown}
        >
          <EyeIcon slashed={shown} />
        </button>
      </div>

      <div className="adm-row">
        <label className="adm-check">
          <input type="checkbox" name="remember" />
          Manter conectada neste dispositivo
        </label>
        <Link href="/admin/recuperar" className="adm-link">
          Esqueci minha senha
        </Link>
      </div>

      <button type="submit" className="adm-btn adm-btn-gold" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
