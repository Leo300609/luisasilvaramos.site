'use client'

import { useActionState, useRef } from 'react'

import { Spinner } from '@/components/admin/icons'

import {
  cancelAction,
  closeAction,
  notesAction,
  rescheduleAction,
  type FormState,
} from '../../actions'

/** Actions on an active booking: reschedule, cancel and, after the time, close it. */
export function ManageActions({
  bookingId,
  date,
  time,
  canClose,
  hasEmail,
}: {
  bookingId: string
  date: string
  time: string
  canClose: boolean
  hasEmail: boolean
}) {
  const [rState, reschedule, rescheduling] = useActionState<FormState, FormData>(
    rescheduleAction.bind(null, bookingId),
    {},
  )
  const [cState, cancel, cancelling] = useActionState<FormState, FormData>(
    cancelAction.bind(null, bookingId),
    {},
  )
  const [dState, done, closing] = useActionState<FormState>(
    closeAction.bind(null, bookingId, 'concluido'),
    {},
  )
  const [nState, noShow, marking] = useActionState<FormState>(
    closeAction.bind(null, bookingId, 'nao_compareceu'),
    {},
  )
  const moveDlg = useRef<HTMLDialogElement>(null)
  const cancelDlg = useRef<HTMLDialogElement>(null)
  const error = dState.error ?? nState.error
  const busy = rescheduling || cancelling || closing || marking

  return (
    <footer className="adm-detail-actions">
      {error && (
        <p role="alert" className="adm-alert adm-alert-error">
          {error}
        </p>
      )}
      <div className="adm-actions-row">
        {canClose ? (
          <>
            <form action={done}>
              <button type="submit" className="adm-btn adm-btn-gold" disabled={busy}>
                {closing && <Spinner />}
                Concluir
              </button>
            </form>
            <form action={noShow}>
              <button type="submit" className="adm-btn adm-btn-out" disabled={busy}>
                {marking && <Spinner />}
                Não compareceu
              </button>
            </form>
          </>
        ) : (
          <>
            <button
              type="button"
              className="adm-btn adm-btn-out"
              onClick={() => moveDlg.current?.showModal()}
              disabled={busy}
            >
              Remarcar
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-terra"
              onClick={() => cancelDlg.current?.showModal()}
              disabled={busy}
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      <dialog ref={moveDlg} className="adm-dialog" aria-labelledby="mv-t">
        <form action={reschedule} className="adm-form">
          <h2 id="mv-t" className="adm-dialog-title">
            Remarcar
          </h2>
          {rState.error && (
            <p role="alert" className="adm-alert adm-alert-error">
              {rState.error}
            </p>
          )}
          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Nova data</span>
              <input type="date" name="date" required defaultValue={date} />
            </label>
            <label className="adm-field">
              <span>Novo horário</span>
              <input type="time" name="time" required defaultValue={time} />
            </label>
          </div>
          {hasEmail && (
            <label className="adm-check">
              <input type="checkbox" name="notify" defaultChecked />
              Avisar a cliente por e-mail
            </label>
          )}
          <div className="adm-actions-row">
            <button
              type="button"
              className="adm-btn adm-btn-out"
              onClick={() => moveDlg.current?.close()}
            >
              Voltar
            </button>
            <button type="submit" className="adm-btn adm-btn-gold" disabled={rescheduling}>
              {rescheduling && <Spinner />}
              Remarcar
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={cancelDlg} className="adm-dialog" aria-labelledby="cc-t">
        <form action={cancel} className="adm-form">
          <h2 id="cc-t" className="adm-dialog-title">
            Cancelar este agendamento?
          </h2>
          {cState.error && (
            <p role="alert" className="adm-alert adm-alert-error">
              {cState.error}
            </p>
          )}
          <label className="adm-field">
            <span>Motivo</span>
            <select name="reason" required defaultValue="imprevisto_maquiadora">
              <option value="imprevisto_maquiadora">Imprevisto meu</option>
              <option value="pedido_cliente">A cliente pediu</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Anotação interna (opcional)</span>
            <textarea name="note" rows={2} maxLength={500} />
          </label>
          {hasEmail && (
            <label className="adm-check">
              <input type="checkbox" name="notify" defaultChecked />
              Avisar a cliente por e-mail
            </label>
          )}
          <div className="adm-actions-row">
            <button
              type="button"
              className="adm-btn adm-btn-out"
              onClick={() => cancelDlg.current?.close()}
            >
              Voltar
            </button>
            <button type="submit" className="adm-btn adm-btn-terra" disabled={cancelling}>
              {cancelling && <Spinner />}
              Sim, cancelar
            </button>
          </div>
        </form>
      </dialog>
    </footer>
  )
}

export function NotesForm({ bookingId, initial }: { bookingId: string; initial: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    notesAction.bind(null, bookingId),
    {},
  )
  return (
    <form action={action} className="adm-block">
      <label htmlFor="dr-notas" className="adm-label">
        Anotações internas
      </label>
      <textarea
        id="dr-notas"
        name="notes"
        rows={3}
        maxLength={2000}
        defaultValue={initial}
        className="adm-textarea"
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
