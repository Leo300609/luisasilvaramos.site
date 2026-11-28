'use client'

import { useActionState, useState } from 'react'

import { Spinner } from '@/components/admin/icons'
import { EVENT_DURATIONS } from '@/lib/format'

import { newBookingAction, type NewBookingState } from '../../actions'

export function NewBookingForm({
  services,
  date,
  time,
}: {
  services: Array<{ id: number; name: string; active: boolean }>
  date: string
  time: string
}) {
  const [state, action, pending] = useActionState<NewBookingState, FormData>(newBookingAction, {})
  const [byCep, setByCep] = useState(true)
  return (
    <form action={action} className="adm-form adm-panel adm-pad">
      {state.error && (
        <p role="alert" className="adm-alert adm-alert-error">
          {state.error}
        </p>
      )}

      <fieldset className="adm-fieldset">
        <legend>Atendimento</legend>
        <label className="adm-field is-wide">
          <span>Serviço</span>
          <select name="serviceId" required defaultValue="">
            <option value="" disabled>
              Escolha
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? '' : ' (inativo no site)'}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span>Data</span>
          <input type="date" name="date" required defaultValue={date} />
        </label>
        <label className="adm-field">
          <span>Início da maquiagem</span>
          <input type="time" name="time" required defaultValue={time} />
        </label>
        <label className="adm-field">
          <span>Horário do evento (opcional)</span>
          <input type="time" name="eventStart" />
        </label>
        <label className="adm-field">
          <span>Duração do evento (opcional)</span>
          <select name="eventDuration" defaultValue="">
            <option value="">Não informado</option>
            {EVENT_DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="adm-fieldset">
        <legend>Cliente</legend>
        <label className="adm-field is-wide">
          <span>Nome</span>
          <input
            type="text"
            name="name"
            required
            minLength={3}
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          <span>WhatsApp com DDD</span>
          <input
            type="tel"
            name="phone"
            required
            inputMode="tel"
            maxLength={20}
            placeholder="(11) 90000-0000"
          />
        </label>
        <label className="adm-field">
          <span>E-mail (opcional)</span>
          <input type="email" name="email" maxLength={200} />
          <small>Com e-mail, a cliente recebe a confirmação e o link da Minha agenda.</small>
        </label>
      </fieldset>

      <fieldset className="adm-fieldset">
        <legend>Local e deslocamento</legend>
        <label className="adm-check is-wide">
          <input type="checkbox" checked={byCep} onChange={(e) => setByCep(e.target.checked)} />
          Calcular a taxa pelo CEP
        </label>
        {byCep ? (
          <>
            <label className="adm-field">
              <span>CEP</span>
              <input
                type="text"
                name="cep"
                required
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
              />
            </label>
            <label className="adm-field">
              <span>Número</span>
              <input type="text" name="number" required maxLength={20} />
            </label>
          </>
        ) : (
          <>
            <label className="adm-field is-wide">
              <span>Endereço</span>
              <input type="text" name="address" required minLength={5} maxLength={300} />
            </label>
            <label className="adm-field">
              <span>Taxa de deslocamento (R$)</span>
              <input type="text" name="fee" inputMode="decimal" defaultValue="0" maxLength={10} />
            </label>
            <label className="adm-field">
              <span>Tempo de ida (minutos)</span>
              <input type="number" name="travelMin" min={0} max={480} step={5} defaultValue={0} />
              <small>A volta usa o mesmo tempo.</small>
            </label>
          </>
        )}
        <label className="adm-field is-wide">
          <span>Complemento (opcional)</span>
          <input type="text" name="complement" maxLength={200} />
        </label>
      </fieldset>

      <label className="adm-field">
        <span>Anotação interna (opcional, a cliente não vê)</span>
        <textarea name="notes" maxLength={1000} rows={3} />
      </label>

      <button type="submit" className="adm-btn adm-btn-gold" disabled={pending}>
        {pending && <Spinner />}
        Agendar
      </button>
    </form>
  )
}
