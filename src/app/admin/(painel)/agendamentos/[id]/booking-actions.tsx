'use client'

import { useActionState, useRef } from 'react'

import { Spinner } from '@/components/admin/icons'

import { confirmBookingAction, declineBookingAction, type BookingActionState } from '../../actions'

/** Confirm / decline a pending request. Declining asks for confirmation in a dialog. */
export function BookingActions({
  bookingId,
  customerFirstName,
}: {
  bookingId: string
  customerFirstName: string
}) {
  const [confirmState, confirm, confirming] = useActionState<BookingActionState>(
    confirmBookingAction.bind(null, bookingId),
    {},
  )
  const [declineState, decline, declining] = useActionState<BookingActionState, FormData>(
    declineBookingAction.bind(null, bookingId),
    {},
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const error = confirmState.error ?? declineState.error

  return (
    <footer className="adm-detail-actions">
      {error && (
        <p role="alert" className="adm-alert adm-alert-error">
          {error}
        </p>
      )}
      <div className="adm-actions-row">
        <form action={confirm}>
          <button type="submit" className="adm-btn adm-btn-gold" disabled={confirming || declining}>
            {confirming && <Spinner />}
            Confirmar
          </button>
        </form>
        <button
          type="button"
          className="adm-btn adm-btn-terra"
          onClick={() => dialog.current?.showModal()}
          disabled={confirming || declining}
        >
          Recusar
        </button>
      </div>

      <dialog ref={dialog} className="adm-dialog" aria-labelledby="dlg-t">
        <form action={decline} className="adm-form">
          <h2 id="dlg-t" className="adm-dialog-title">
            Recusar este pedido?
          </h2>
          <p className="adm-sub">
            O horário fica livre e {customerFirstName} recebe um e-mail dizendo que não foi possível
            atender, com um link para escolher outra data.
          </p>
          <label className="adm-field-label" htmlFor="decline-note">
            Anotação interna (opcional, a cliente não vê)
          </label>
          <textarea
            id="decline-note"
            name="note"
            rows={3}
            maxLength={500}
            className="adm-textarea"
          />
          <div className="adm-actions-row">
            <button
              type="button"
              className="adm-btn adm-btn-out"
              onClick={() => dialog.current?.close()}
            >
              Voltar
            </button>
            <button type="submit" className="adm-btn adm-btn-terra" disabled={declining}>
              {declining && <Spinner />}
              Sim, recusar
            </button>
          </div>
        </form>
      </dialog>
    </footer>
  )
}
