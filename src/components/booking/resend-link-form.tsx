'use client'

import { useId, useState, type FormEvent } from 'react'

type State = 'idle' | 'sending' | 'sent' | 'error'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Perdi o link": asks for a new "Minha agenda" link by e-mail. */
export function ResendLinkForm() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [invalid, setInvalid] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!EMAIL.test(email.trim())) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setState('sending')
    try {
      const response = await fetch('/api/agendamento/minha/reenviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      setState(response.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className="resend-done">
        Se esse e-mail tiver um agendamento ativo, o link chega em alguns minutos. Confira também a
        caixa de spam.
      </p>
    )
  }

  return (
    <form className="resend-form" onSubmit={onSubmit} noValidate aria-label="Reenviar meu link">
      <div className="app-field-group">
        <label htmlFor={`${id}-email`}>Perdeu o link? Receba de novo por e-mail</label>
        <input
          id={`${id}-email`}
          className="app-field"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={200}
          placeholder="O e-mail usado no agendamento"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid || state === 'error' ? `${id}-error` : undefined}
        />
        {(invalid || state === 'error') && (
          <p id={`${id}-error`} className="app-error" role="alert">
            {invalid
              ? 'Informe um e-mail válido.'
              : 'Não foi possível enviar agora. Tente de novo em instantes.'}
          </p>
        )}
      </div>
      <button type="submit" className="app-btn app-btn-out" disabled={state === 'sending'}>
        {state === 'sending' ? 'Enviando…' : 'Reenviar link'}
      </button>
    </form>
  )
}
