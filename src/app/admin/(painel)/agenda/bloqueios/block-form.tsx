'use client'

import { useActionState, useState } from 'react'

import { Spinner } from '@/components/admin/icons'

import { createBlockAction, type FormState } from '../../actions'

export function BlockForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBlockAction, {})
  const [allDay, setAllDay] = useState(true)
  return (
    <form action={action} className="adm-form adm-form-grid">
      {state.error && (
        <p role="alert" className="adm-alert adm-alert-error is-wide">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="adm-alert adm-alert-ok is-wide">
          {state.ok}
        </p>
      )}
      <label className="adm-check is-wide">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        Dia inteiro
      </label>
      <label className="adm-field">
        <span>{allDay ? 'De' : 'Dia'}</span>
        <input type="date" name="date" required min={today} defaultValue={today} />
      </label>
      {allDay ? (
        <label className="adm-field">
          <span>Até (opcional)</span>
          <input type="date" name="endDate" min={today} />
        </label>
      ) : (
        <>
          <label className="adm-field">
            <span>Das</span>
            <input type="time" name="start" required defaultValue="12:00" />
          </label>
          <label className="adm-field">
            <span>Até</span>
            <input type="time" name="end" required defaultValue="14:00" />
          </label>
        </>
      )}
      <label className="adm-field is-wide">
        <span>Motivo (só você vê)</span>
        <input type="text" name="reason" maxLength={120} placeholder="Ex.: Folga, Curso, Viagem" />
      </label>
      <button type="submit" className="adm-btn adm-btn-gold is-wide" disabled={pending}>
        {pending && <Spinner />}
        Bloquear
      </button>
    </form>
  )
}
