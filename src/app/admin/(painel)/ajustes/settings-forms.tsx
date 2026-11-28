'use client'

import { useActionState } from 'react'

import { Spinner } from '@/components/admin/icons'
import type { RulesInput } from '@/server/admin/settings'

import {
  baseAddressAction,
  hoursAction,
  rulesAction,
  serviceAction,
  type FormState,
} from '../actions'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

function Feedback({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="adm-alert adm-alert-error is-wide">
        {state.error}
      </p>
    )
  if (state.ok)
    return (
      <p role="status" className="adm-alert adm-alert-ok is-wide">
        {state.ok}
      </p>
    )
  return null
}

function Save({ pending, label = 'Salvar' }: { pending: boolean; label?: string }) {
  return (
    <button type="submit" className="adm-btn adm-btn-gold is-wide" disabled={pending}>
      {pending && <Spinner />}
      {label}
    </button>
  )
}

type Service = {
  id: number
  name: string
  category: string
  durationMin: number
  priceCents: number
  description: string
  active: boolean
  sortOrder: number
}

export function ServiceForm({ service }: { service: Service | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    serviceAction.bind(null, service?.id ?? null),
    {},
  )
  const p = service?.id ?? 'novo'
  return (
    <form action={action} className="adm-form-grid adm-disclosure-body">
      <Feedback state={state} />
      <label className="adm-field is-wide">
        <span>Nome</span>
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={service?.name}
          id={`sv-name-${p}`}
        />
      </label>
      <label className="adm-field">
        <span>Categoria</span>
        <input name="category" required maxLength={40} defaultValue={service?.category} />
      </label>
      <label className="adm-field">
        <span>Duração (minutos)</span>
        <input
          name="durationMin"
          type="number"
          min={15}
          max={600}
          step={5}
          required
          defaultValue={service?.durationMin ?? 60}
        />
      </label>
      <label className="adm-field">
        <span>Preço (R$)</span>
        <input
          name="price"
          inputMode="decimal"
          required
          defaultValue={service ? money(service.priceCents) : ''}
          placeholder="0,00"
        />
      </label>
      <label className="adm-field">
        <span>Ordem no site</span>
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          defaultValue={service?.sortOrder ?? 0}
        />
      </label>
      <label className="adm-field is-wide">
        <span>Descrição curta</span>
        <textarea name="description" maxLength={300} rows={2} defaultValue={service?.description} />
      </label>
      <label className="adm-check is-wide">
        <input type="checkbox" name="active" defaultChecked={service?.active ?? true} />
        Disponível para agendamento no site
      </label>
      <Save pending={pending} label={service ? 'Salvar serviço' : 'Criar serviço'} />
    </form>
  )
}

export function HoursForm({
  hours,
}: {
  hours: Array<{ weekday: number; isOpen: boolean; opensAt: string; closesAt: string }>
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(hoursAction, {})
  // Monday first, like the agenda.
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <form action={action} className="adm-form">
      <Feedback state={state} />
      <div className="adm-hours">
        {order.map((wd) => {
          const h = hours[wd]!
          return (
            <fieldset key={wd} className="adm-hours-row">
              <legend className="sr-only">{WEEKDAYS[wd]}</legend>
              <label className="adm-check">
                <input type="checkbox" name={`open-${wd}`} defaultChecked={h.isOpen} />
                {WEEKDAYS[wd]}
              </label>
              <label className="adm-field">
                <span className="sr-only">Início de {WEEKDAYS[wd]}</span>
                <input type="time" name={`from-${wd}`} defaultValue={h.opensAt} />
              </label>
              <span aria-hidden="true">às</span>
              <label className="adm-field">
                <span className="sr-only">Fim de {WEEKDAYS[wd]}</span>
                <input type="time" name={`to-${wd}`} defaultValue={h.closesAt} />
              </label>
            </fieldset>
          )
        })}
      </div>
      <Save pending={pending} label="Salvar horários" />
    </form>
  )
}

type Rules = Required<{ [K in keyof RulesInput]: Exclude<RulesInput[K], undefined> }>

function Num({
  name,
  label,
  value,
  min,
  max,
  step = 1,
  hint,
}: {
  name: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  hint?: string
}) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      <input
        type="number"
        name={name}
        min={min}
        max={max}
        step={step}
        required
        defaultValue={value}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function RulesForm({ rules }: { rules: Rules }) {
  const [state, action, pending] = useActionState<FormState, FormData>(rulesAction, {})
  const r = rules as Record<string, number | boolean | string>
  return (
    <form action={action} className="adm-form">
      <Feedback state={state} />
      <fieldset className="adm-fieldset">
        <legend>Pedidos</legend>
        <label className="adm-check is-wide">
          <input
            type="checkbox"
            name="manualConfirmation"
            defaultChecked={rules.manualConfirmation as boolean}
          />
          Confirmar cada pedido manualmente
        </label>
        <label className="adm-check is-wide">
          <input
            type="checkbox"
            name="bookingsPaused"
            defaultChecked={rules.bookingsPaused as boolean}
          />
          Pausar agendamentos pelo site (férias, emergência)
        </label>
        <Num
          name="pendingExpiryHours"
          label="Prazo para confirmar (horas)"
          value={r.pendingExpiryHours as number}
          min={1}
          max={168}
          hint="Depois disso o pedido expira e o horário volta a ficar livre."
        />
        <Num
          name="maxPendingPerContact"
          label="Pedidos pendentes por cliente"
          value={r.maxPendingPerContact as number}
          min={1}
          max={10}
        />
        <Num
          name="cancelWindowHours"
          label="Cancelar ou remarcar online até (horas antes)"
          value={r.cancelWindowHours as number}
          min={0}
          max={720}
        />
      </fieldset>
      <fieldset className="adm-fieldset">
        <legend>Horários oferecidos</legend>
        <Num
          name="minNoticeHours"
          label="Antecedência mínima (horas)"
          value={r.minNoticeHours as number}
          min={0}
          max={720}
        />
        <Num
          name="horizonDays"
          label="Agenda aberta até (dias à frente)"
          value={r.horizonDays as number}
          min={7}
          max={730}
        />
        <Num
          name="slotStepMin"
          label="Intervalo entre horários (min)"
          value={r.slotStepMin as number}
          min={5}
          max={240}
          step={5}
        />
        <Num
          name="bufferMin"
          label="Folga depois de cada atendimento (min)"
          value={r.bufferMin as number}
          min={0}
          max={120}
          step={5}
        />
        <label className="adm-check is-wide">
          <input
            type="checkbox"
            name="lunchEnabled"
            defaultChecked={rules.lunchEnabled as boolean}
          />
          Reservar horário de almoço
        </label>
        <label className="adm-field">
          <span>Almoço das</span>
          <input type="time" name="lunchStart" defaultValue={r.lunchStart as string} />
        </label>
        <label className="adm-field">
          <span>Almoço até</span>
          <input type="time" name="lunchEnd" defaultValue={r.lunchEnd as string} />
        </label>
      </fieldset>
      <fieldset className="adm-fieldset">
        <legend>Regra do evento</legend>
        <Num
          name="readyBeforeEventMin"
          label="Cliente pronta antes do evento (min)"
          value={r.readyBeforeEventMin as number}
          min={0}
          max={240}
          step={5}
        />
        <Num
          name="recommendedMarginMin"
          label="Folga recomendada a mais (min)"
          value={r.recommendedMarginMin as number}
          min={0}
          max={480}
          step={5}
        />
      </fieldset>
      <fieldset className="adm-fieldset">
        <legend>Taxa de deslocamento</legend>
        <label className="adm-field">
          <span>Taxa mínima (R$)</span>
          <input
            name="travelMinFee"
            inputMode="decimal"
            required
            defaultValue={money(r.travelMinFeeCents as number)}
          />
        </label>
        <label className="adm-field">
          <span>Por km rodado (R$)</span>
          <input
            name="travelPerKm"
            inputMode="decimal"
            required
            defaultValue={money(r.travelPerKmCents as number)}
          />
          <small>Conta ida e volta.</small>
        </label>
        <Num
          name="travelMaxRadiusKm"
          label="Raio máximo (km)"
          value={r.travelMaxRadiusKm as number}
          min={1}
          max={500}
        />
        <label className="adm-field">
          <span>Margem para o trânsito</span>
          <input
            name="travelSafetyFactor"
            inputMode="decimal"
            required
            defaultValue={String(r.travelSafetyFactor).replace('.', ',')}
          />
          <small>1,3 = 30% a mais que o tempo estimado.</small>
        </label>
      </fieldset>
      <Save pending={pending} label="Salvar regras" />
    </form>
  )
}

export function BaseAddressForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(baseAddressAction, {})
  return (
    <form action={action} className="adm-form-grid">
      <Feedback state={state} />
      <label className="adm-field">
        <span>CEP</span>
        <input name="cep" required inputMode="numeric" maxLength={9} placeholder="00000-000" />
      </label>
      <label className="adm-field">
        <span>Número</span>
        <input name="number" maxLength={20} />
      </label>
      <Save pending={pending} label="Salvar endereço" />
    </form>
  )
}
