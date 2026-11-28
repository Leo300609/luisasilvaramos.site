'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { AlertIcon, CheckCircleIcon, ShieldIcon, Spinner } from '@/components/admin/icons'

import { enrollAction, type EnrollState } from '../actions'

export function EnrollForm({
  qrSvg,
  secret,
  alreadyEnabled = false,
}: {
  qrSvg: string
  secret: string
  alreadyEnabled?: boolean
}) {
  const [state, action, pending] = useActionState<EnrollState, FormData>(enrollAction, {})

  if (state.recoveryCodes) {
    return (
      <div className="adm-form">
        <span className="adm-icon-badge">
          <CheckCircleIcon size={28} />
        </span>
        <div>
          <h1 className="adm-title">Tudo pronto</h1>
          <p className="adm-sub">
            Guarde estes códigos de recuperação num lugar seguro (anote no papel ou no gerenciador
            de senhas). Se perder o celular, cada código permite entrar uma vez. Eles não serão
            mostrados de novo.
          </p>
        </div>
        <ul className="adm-codes" aria-label="Códigos de recuperação">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link href="/admin" className="adm-btn adm-btn-gold">
          Já guardei, entrar no painel
        </Link>
      </div>
    )
  }

  if (alreadyEnabled) {
    return (
      <div className="adm-form">
        <h1 className="adm-title">Verificação ativa</h1>
        <p className="adm-sub">A verificação em 2 etapas já está configurada nesta conta.</p>
        <Link href="/admin" className="adm-btn adm-btn-gold">
          Ir para o painel
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="adm-form" aria-labelledby="t-setup">
      <span className="adm-icon-badge">
        <ShieldIcon size={28} />
      </span>
      <div>
        <h1 id="t-setup" className="adm-title">
          Proteja sua conta
        </h1>
        <p className="adm-sub">
          No primeiro acesso, ative a verificação em 2 etapas. Leva um minuto.
        </p>
      </div>
      <ol className="adm-steps">
        <li>
          Instale um app autenticador no celular (Google Authenticator, Microsoft Authenticator ou o
          do seu gerenciador de senhas).
        </li>
        <li>No app, toque em “adicionar” e escaneie o código abaixo.</li>
        <li>Digite o código de 6 dígitos que aparecer.</li>
      </ol>
      <div
        className="adm-qr"
        role="img"
        aria-label="QR code para o app autenticador"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div>
        <p className="adm-sub" style={{ marginBottom: 8 }} id="secret-help">
          Não consegue escanear? Digite esta chave no app:
        </p>
        <p className="adm-secret" aria-describedby="secret-help">
          {secret}
        </p>
      </div>

      {state.error === 'invalid' && (
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>Código inválido.</strong> Confira se o horário do celular está automático e
            tente o código atual.
          </span>
        </div>
      )}
      {state.error === 'expired' && (
        <div role="alert" className="adm-alert adm-alert-error">
          <AlertIcon />
          <span>
            <strong>O tempo acabou.</strong> <Link href="/admin/entrar">Entre de novo</Link> para
            continuar.
          </span>
        </div>
      )}

      <label htmlFor="setup-code" className="adm-sub" style={{ margin: 0 }}>
        Código de 6 dígitos
      </label>
      <input
        id="setup-code"
        name="code"
        className="adm-otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        aria-invalid={state.error === 'invalid' || undefined}
      />
      <button type="submit" className="adm-btn adm-btn-gold" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        Ativar e continuar
      </button>
    </form>
  )
}
