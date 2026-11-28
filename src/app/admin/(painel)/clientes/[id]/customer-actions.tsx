'use client'

import { useActionState, useRef } from 'react'

import { Spinner } from '@/components/admin/icons'

import { customerNotesAction, forgetCustomerAction, type FormState } from '../../actions'

export function CustomerNotes({ customerId, initial }: { customerId: string; initial: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    customerNotesAction.bind(null, customerId),
    {},
  )
  return (
    <form action={action} className="adm-block">
      <label htmlFor="cl-notes" className="adm-label">
        Anotações sobre a cliente
      </label>
      <textarea
        id="cl-notes"
        name="notes"
        rows={3}
        maxLength={2000}
        defaultValue={initial}
        className="adm-textarea"
        placeholder="Tipo de pele, preferências, produtos que funcionam bem…"
      />
      <div className="adm-row">
        <span role="status" className="adm-small">
          {state.ok}
        </span>
        <button type="submit" className="adm-btn adm-btn-line" disabled={pending}>
          Salvar anotação
        </button>
      </div>
    </form>
  )
}

export function ForgetCustomer({ customerId, name }: { customerId: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    forgetCustomerAction.bind(null, customerId),
    {},
  )
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        type="button"
        className="adm-btn adm-btn-terra"
        onClick={() => dialog.current?.showModal()}
      >
        Apagar dados
      </button>
      <dialog ref={dialog} className="adm-dialog" aria-labelledby="fg-t">
        <form action={action} className="adm-form">
          <h2 id="fg-t" className="adm-dialog-title">
            Apagar os dados de {name}?
          </h2>
          <p className="adm-sub">
            Não dá para desfazer. Para confirmar, digite <strong>APAGAR</strong>.
          </p>
          {state.error && (
            <p role="alert" className="adm-alert adm-alert-error">
              {state.error}
            </p>
          )}
          <label className="adm-field">
            <span>Confirmação</span>
            <input type="text" name="confirm" required autoComplete="off" pattern="APAGAR" />
          </label>
          <div className="adm-actions-row">
            <button
              type="button"
              className="adm-btn adm-btn-out"
              onClick={() => dialog.current?.close()}
            >
              Voltar
            </button>
            <button type="submit" className="adm-btn adm-btn-terra" disabled={pending}>
              {pending && <Spinner />}
              Apagar
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
