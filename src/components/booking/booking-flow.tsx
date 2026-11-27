'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { Alert, ArrowRight, ChevronLeft, ChevronRight, ServiceIcon } from '@/components/site/icons'
import { formatBrazilianPhone, isValidBrazilianPhone } from '@/lib/contact-form'
import { DEFAULT_WHATSAPP_MESSAGE, whatsappLink } from '@/lib/contact'
import {
  EVENT_DURATIONS,
  eventDurationLabel,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatMoney,
  formatMonth,
  todayInSaoPaulo,
} from '@/lib/format'

export type BookingService = {
  id: number
  slug: string
  name: string
  description: string
  durationMin: number
  priceCents: number
}

type Quote = {
  token: string
  addressLine: string
  complement: string | null
  feeCents: number
  travelMin: number
  distanceKm: number
}

type Slot = { time: string; fit: 'recommended' | 'ok' | 'tight' }

const STEPS = ['Serviço', 'Evento e local', 'Data e horário', 'Seus dados', 'Confirmação'] as const

const QUOTE_ERRORS: Record<string, string> = {
  'cep-not-found': 'Não encontramos esse CEP. Confira os números.',
  'no-coordinates':
    'Não conseguimos localizar esse endereço automaticamente. Fale com a Luísa pelo WhatsApp para agendar.',
  'out-of-radius':
    'Esse endereço fica fora da região de atendimento online. Fale com a Luísa pelo WhatsApp: ela avalia o deslocamento.',
  'base-not-configured':
    'O agendamento online ainda está sendo configurado. Fale com a Luísa pelo WhatsApp.',
}

type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; message?: string }

async function api<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: string
      message?: string
    }
    if (response.ok) return { ok: true, status: response.status, data }
    return {
      ok: false,
      status: response.status,
      error: data.error ?? 'internal',
      ...(data.message ? { message: data.message } : {}),
    }
  } catch {
    return { ok: false, status: 0, error: 'network' }
  }
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

function monthGrid(month: string) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1))
  const days = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: first.getUTCDay() }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function BookingFlow({
  services,
  initialServiceSlug,
}: {
  services: BookingService[]
  initialServiceSlug?: string
}) {
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState(1)

  const [serviceId, setServiceId] = useState<number | null>(
    services.find((s) => s.slug === initialServiceSlug)?.id ?? null,
  )
  const service = services.find((s) => s.id === serviceId) ?? null

  // Step 2
  const [eventStart, setEventStart] = useState('')
  const [eventDuration, setEventDuration] = useState('')
  const [cep, setCep] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)

  // Step 3
  const today = useMemo(() => todayInSaoPaulo(), [])
  const [month, setMonth] = useState(today.slice(0, 7))
  const [monthDays, setMonthDays] = useState<Record<string, number> | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [time, setTime] = useState<string | null>(null)
  const [takenNotice, setTakenNotice] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Step 4
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [lookNotes, setLookNotes] = useState('')
  const [allergyNotes, setAllergyNotes] = useState('')
  const [allergyConsent, setAllergyConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 5
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const go = (next: number) => {
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // Move focus to the step title so screen readers announce the new step.
    requestAnimationFrame(() => headingRef.current?.focus())
    if (next === 3 && monthDays === null) void loadMonth(month)
  }

  // Any change that affects travel/availability invalidates the chosen slot.
  const resetSchedule = () => {
    setDate(null)
    setTime(null)
    setSlots(null)
    setMonthDays(null)
  }

  async function calculateQuote() {
    setQuoteError(null)
    if (!/^\d{5}-?\d{3}$/.test(cep) || !number.trim()) {
      setQuoteError('Informe o CEP (8 números) e o número do endereço.')
      return
    }
    setQuoting(true)
    const result = await api<Quote>('/api/agendamento/cotacao', {
      cep,
      number,
      ...(complement.trim() ? { complement } : {}),
    })
    setQuoting(false)
    resetSchedule()
    if (result.ok) setQuote(result.data)
    else {
      setQuote(null)
      setQuoteError(
        QUOTE_ERRORS[result.error] ??
          'Não conseguimos calcular agora. Verifique sua conexão e tente de novo.',
      )
    }
  }

  async function loadMonth(target: string) {
    if (!serviceId || !quote || !eventStart) return
    setMonthDays(null)
    setLoadError(false)
    const result = await api<{ days: Record<string, number> }>('/api/agendamento/horarios', {
      serviceId,
      quote: quote.token,
      eventStart,
      month: target,
    })
    if (result.ok) setMonthDays(result.data.days)
    else if (result.error === 'quote-expired') {
      setQuote(null)
      setQuoteError('O cálculo do deslocamento expirou. Calcule de novo, por favor.')
      setStep(2)
    } else setLoadError(true)
  }

  async function loadDay(target: string) {
    if (!serviceId || !quote || !eventStart) return
    setSlots(null)
    setSuggestions([])
    const result = await api<{ slots: Slot[]; suggestions: string[] }>(
      '/api/agendamento/horarios',
      { serviceId, quote: quote.token, eventStart, date: target },
    )
    if (result.ok) {
      setSlots(result.data.slots)
      setSuggestions(result.data.suggestions)
    } else setLoadError(true)
  }

  function changeMonth(target: string) {
    setMonth(target)
    void loadMonth(target)
  }

  function pickDate(target: string) {
    setDate(target)
    setTime(null)
    void loadDay(target)
  }

  function validateData() {
    const e: Record<string, string> = {}
    if (name.trim().length < 5 || !name.trim().includes(' ')) e.name = 'Informe seu nome completo.'
    if (!isValidBrazilianPhone(phone)) e.phone = 'Informe um WhatsApp válido com DDD.'
    if (!isEmail(email)) e.email = 'Informe um e-mail válido, como nome@email.com.'
    if (allergyNotes.trim() && !allergyConsent)
      e.allergyConsent = 'Para registrar alergias, marque a autorização acima.'
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) document.getElementById(`b-${first}`)?.focus()
    return !first
  }

  const canContinue =
    (step === 1 && !!service) ||
    (step === 2 && !!eventStart && !!eventDuration && !!quote) ||
    (step === 3 && !!date && !!time) ||
    step === 4 ||
    (step === 5 && policyAccepted && !submitting)

  async function next() {
    if (step === 4 && !validateData()) return
    if (step < 5) return go(step + 1)
    if (!service || !quote || !date || !time) return
    setSubmitting(true)
    setSubmitError(null)
    const result = await api<{ code: string; status: string }>('/api/agendamento', {
      idempotencyKey,
      serviceId: service.id,
      date,
      time,
      eventStart,
      eventDuration,
      customer: { name: name.trim(), phone, email: email.trim() },
      quote: quote.token,
      ...(lookNotes.trim() ? { lookNotes } : {}),
      ...(allergyNotes.trim() ? { allergyNotes, allergyConsent } : {}),
      policyAccepted: true,
    })
    setSubmitting(false)
    if (result.ok) {
      router.push('/agendar/minha-agenda?novo=1')
      return
    }
    if (result.error === 'slot-taken') {
      setTakenNotice(true)
      setTime(null)
      void loadDay(date)
      go(3)
    } else if (result.error === 'quote-expired') {
      setQuote(null)
      setQuoteError('O cálculo do deslocamento expirou. Calcule de novo, por favor.')
      go(2)
    } else if (result.error === 'too-many-pending' || result.error === 'consent-required') {
      setSubmitError(result.message ?? 'Não foi possível concluir.')
    } else {
      setSubmitError('network')
    }
  }

  const total = (service?.priceCents ?? 0) + (quote?.feeCents ?? 0)
  const progress = `${((step - 1) / (STEPS.length - 1)) * 80}%`

  const summary = service && step > 1 && step < 5 && (
    <aside className="app-summary" aria-label="Resumo até aqui">
      <span>Seu agendamento</span>
      <h2>{service.name}</h2>
      <dl>
        <div>
          <dt>Duração</dt>
          <dd>{formatDuration(service.durationMin)}</dd>
        </div>
        {eventStart && (
          <div>
            <dt>Evento</dt>
            <dd>
              às {eventStart}
              {eventDuration ? ` · ${eventDurationLabel(eventDuration).toLowerCase()}` : ''}
            </dd>
          </div>
        )}
        {date && (
          <div>
            <dt>Data</dt>
            <dd>
              {formatDateShort(date)}
              {time ? `, ${time}` : ''}
            </dd>
          </div>
        )}
        <div>
          <dt>Maquiagem</dt>
          <dd>{formatMoney(service.priceCents)}</dd>
        </div>
        {quote && (
          <div>
            <dt>Deslocamento</dt>
            <dd>{formatMoney(quote.feeCents)}</dd>
          </div>
        )}
        <div className="is-total">
          <dt>Valor estimado</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
      </dl>
    </aside>
  )

  const fieldErr = (key: string) =>
    errors[key] ? (
      <p id={`b-${key}-erro`} className="app-error">
        <Alert size={16} />
        {errors[key]}
      </p>
    ) : null
  const invalid = (key: string) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `b-${key}-erro` : undefined,
  })

  return (
    <>
      <nav className="app-progress" aria-label="Etapas do agendamento">
        <div className="app-wrap">
          <ol className="app-steps" style={{ '--progress': progress } as React.CSSProperties}>
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i + 1 === step ? 'step' : undefined}
                data-state={i + 1 < step ? 'done' : undefined}
              >
                <span aria-hidden="true">{i + 1 < step ? '✓' : i + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <div className="app-steps-mobile">
            <div>
              <span>
                Passo {step} de {STEPS.length}
              </span>
              <span>{STEPS[step - 1]}</span>
            </div>
            <div className="app-bars" aria-hidden="true">
              {STEPS.map((label, i) => (
                <span key={label} data-on={i < step} />
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main id="conteudo" className="app-main">
        {step === 1 && (
          <section className="app-step" aria-labelledby="t-step">
            <div className="app-step-head">
              <span className="app-eyebrow">Passo 1 de 5</span>
              <h1 id="t-step" ref={headingRef} tabIndex={-1} className="app-h1">
                Escolha o <em>serviço</em>
              </h1>
              <p className="app-lead">
                Selecione a maquiagem que combina com a sua ocasião. A Luísa vai até você: a taxa de
                deslocamento é calculada no próximo passo.
              </p>
            </div>
            <div className="app-services" role="radiogroup" aria-label="Serviços disponíveis">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === serviceId}
                  className="app-sel"
                  onClick={() => {
                    setServiceId(s.id)
                    resetSchedule()
                  }}
                >
                  <span className="app-sel-check" aria-hidden="true">
                    ✓
                  </span>
                  <span className="app-sel-icon" aria-hidden="true">
                    <ServiceIcon name={s.slug} size={26} />
                  </span>
                  <h2>{s.name}</h2>
                  <p>{s.description}</p>
                  <span className="app-sel-meta">
                    <span>{formatDuration(s.durationMin)}</span>
                    <strong>{formatMoney(s.priceCents)}</strong>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="app-step" aria-labelledby="t-step">
            <div className="app-step-head">
              <span className="app-eyebrow">Passo 2 de 5 · {service?.name}</span>
              <h1 id="t-step" ref={headingRef} tabIndex={-1} className="app-h1">
                Evento e <em>local</em>
              </h1>
              <p className="app-lead">
                Com o horário do evento, sugerimos o melhor horário para a sua make. Com o endereço,
                calculamos o deslocamento da Luísa até você.
              </p>
            </div>
            <div className="app-grid-2 is-wide">
              <div className="app-card">
                <div className="app-form">
                  <fieldset className="app-fieldset is-wide">
                    <legend>Sobre o seu evento</legend>
                  </fieldset>
                  <div className="app-field-group">
                    <label htmlFor="b-evh">Horário de início do evento</label>
                    <input
                      id="b-evh"
                      className="app-field"
                      type="time"
                      value={eventStart}
                      onChange={(e) => {
                        setEventStart(e.target.value)
                        resetSchedule()
                      }}
                    />
                    <small>Você precisa estar pronta 30 minutos antes.</small>
                  </div>
                  <div className="app-field-group">
                    <label htmlFor="b-evd">Quanto tempo dura o evento</label>
                    <select
                      id="b-evd"
                      className="app-field"
                      value={eventDuration}
                      onChange={(e) => setEventDuration(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {EVENT_DURATIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <fieldset className="app-fieldset is-wide">
                    <legend>Onde será a maquiagem</legend>
                  </fieldset>
                  <div className="app-field-group">
                    <label htmlFor="b-cep">CEP</label>
                    <input
                      id="b-cep"
                      className="app-field"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      value={cep}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, '').slice(0, 8)
                        setCep(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d)
                        setQuote(null)
                      }}
                    />
                  </div>
                  <div className="app-field-group">
                    <label htmlFor="b-num">Número</label>
                    <input
                      id="b-num"
                      className="app-field"
                      autoComplete="address-line2"
                      value={number}
                      maxLength={20}
                      onChange={(e) => {
                        setNumber(e.target.value)
                        setQuote(null)
                      }}
                    />
                  </div>
                  <div className="app-field-group is-wide">
                    <label htmlFor="b-comp">Complemento e ponto de referência (opcional)</label>
                    <input
                      id="b-comp"
                      className="app-field"
                      value={complement}
                      maxLength={200}
                      onChange={(e) => {
                        setComplement(e.target.value)
                        setQuote(null)
                      }}
                    />
                  </div>
                  <div className="is-wide flex flex-col gap-3">
                    <button
                      type="button"
                      className="app-btn app-btn-out self-start"
                      onClick={calculateQuote}
                      disabled={quoting}
                      aria-busy={quoting}
                    >
                      {quoting ? 'Calculando…' : 'Calcular deslocamento'}
                    </button>
                    <div aria-live="polite">
                      {quote && (
                        <div className="app-notice is-ok">
                          <span>
                            <strong>{quote.addressLine}</strong>
                            Deslocamento: {formatMoney(quote.feeCents)} (cerca de{' '}
                            {quote.distanceKm.toLocaleString('pt-BR')} km). A Luísa reserva{' '}
                            {formatDuration(quote.travelMin)} para chegar até você.
                          </span>
                        </div>
                      )}
                      {quoteError && (
                        <div className="app-notice is-error" role="alert">
                          <Alert size={20} />
                          <span>
                            {quoteError}{' '}
                            <a
                              className="app-link"
                              href={whatsappLink(DEFAULT_WHATSAPP_MESSAGE)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Falar no WhatsApp
                            </a>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {summary}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="app-step" aria-labelledby="t-step">
            <div className="app-step-head">
              <span className="app-eyebrow">Passo 3 de 5 · {service?.name}</span>
              <h1 id="t-step" ref={headingRef} tabIndex={-1} className="app-h1">
                Data e <em>horário</em>
              </h1>
            </div>
            {takenNotice && (
              <div className="app-notice is-warn" role="alert">
                <Alert size={20} />
                <span>
                  <strong>Esse horário acabou de ser reservado</strong>
                  Outra cliente confirmou esse horário enquanto você preenchia os dados. Escolha
                  outro horário abaixo: seus dados continuam salvos.
                </span>
              </div>
            )}
            {loadError && (
              <div className="app-notice is-error" role="alert">
                <Alert size={20} />
                <span>
                  Não conseguimos carregar a agenda agora.{' '}
                  <button type="button" className="app-link" onClick={() => void loadMonth(month)}>
                    Tentar de novo
                  </button>
                </span>
              </div>
            )}
            <div className="app-grid-2">
              <div className="app-card">
                <div className="app-cal-head">
                  <h2 aria-live="polite">{formatMonth(month)}</h2>
                  <div>
                    <button
                      type="button"
                      className="app-btn app-btn-out"
                      onClick={() => changeMonth(shiftMonth(month, -1))}
                      disabled={month <= today.slice(0, 7)}
                      aria-label="Mês anterior"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className="app-btn app-btn-out"
                      onClick={() => changeMonth(shiftMonth(month, 1))}
                      aria-label="Próximo mês"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
                <div className="app-weekdays" aria-hidden="true">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                {monthDays === null ? (
                  <div className="app-days" aria-busy="true" aria-label="Carregando calendário">
                    {Array.from({ length: 35 }, (_, i) => (
                      <span key={i} className="app-skel mx-auto size-10 !rounded-full" />
                    ))}
                  </div>
                ) : (
                  <div
                    className="app-days"
                    role="group"
                    aria-label={`Dias de ${formatMonth(month)}`}
                  >
                    {monthGrid(month).map((d, i) =>
                      d ? (
                        <button
                          key={d}
                          type="button"
                          className="app-day"
                          disabled={!monthDays[d]}
                          aria-pressed={d === date}
                          data-today={d === today}
                          aria-label={`${formatDateLong(d)}, ${monthDays[d] ? 'disponível' : 'indisponível'}`}
                          onClick={() => pickDate(d)}
                        >
                          {Number(d.slice(8))}
                        </button>
                      ) : (
                        <span key={`e${i}`} aria-hidden="true" />
                      ),
                    )}
                  </div>
                )}
                <div className="app-legend" aria-hidden="true">
                  <span>
                    <i style={{ background: '#C9972B', width: 6, height: 6 }} />
                    Disponível
                  </span>
                  <span>
                    <i style={{ background: '#F2B705' }} />
                    Selecionado
                  </span>
                  <span>
                    <i style={{ background: '#F6EFE4', border: '1px solid #E3D3BC' }} />
                    Indisponível
                  </span>
                </div>
              </div>

              <div className="app-card flex flex-col gap-4">
                <div>
                  <span className="app-eyebrow">Horários</span>
                  <h2>
                    {date ? formatDateLong(date).replace(/ de \d{4}$/, '') : 'Escolha uma data'}
                  </h2>
                </div>
                {!date && (
                  <p className="m-0 rounded-2xl bg-cream p-5 text-center text-brown">
                    Escolha um dia disponível no calendário para ver os horários.
                  </p>
                )}
                {date && slots === null && (
                  <div className="app-slots" aria-busy="true" aria-label="Carregando horários">
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} className="app-skel h-14" />
                    ))}
                  </div>
                )}
                {date && slots?.length === 0 && (
                  <div className="app-notice is-warn">
                    <Alert size={20} />
                    <span>
                      <strong>Este dia já está com a agenda completa</strong>
                      {suggestions.length
                        ? 'Que tal um destes dias próximos? Ainda há horários livres:'
                        : 'Escolha outro dia no calendário.'}
                      <span className="mt-3 flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="app-btn app-btn-out !min-h-11"
                            onClick={() => {
                              if (s.slice(0, 7) !== month) changeMonth(s.slice(0, 7))
                              pickDate(s)
                            }}
                          >
                            {formatDateShort(s)}
                          </button>
                        ))}
                      </span>
                    </span>
                  </div>
                )}
                {date && slots && slots.length > 0 && (
                  <>
                    <div className="app-slots" role="radiogroup" aria-label="Horários disponíveis">
                      {slots.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          role="radio"
                          className="app-slot"
                          data-fit={s.fit}
                          aria-checked={s.time === time}
                          aria-label={`${s.time}${s.fit === 'recommended' ? ', recomendado' : s.fit === 'tight' ? ', folga apertada' : ''}`}
                          onClick={() => {
                            setTime(s.time)
                            setTakenNotice(false)
                          }}
                        >
                          {s.time}
                          {s.fit === 'recommended' && <small>Recomendado</small>}
                          {s.fit === 'tight' && <small>Apertado</small>}
                        </button>
                      ))}
                    </div>
                    {time && slots.find((s) => s.time === time)?.fit === 'tight' && (
                      <div className="app-notice is-warn" role="status">
                        <Alert size={20} />
                        <span>
                          Com esse horário você fica pronta perto do início do evento. O ideal é
                          terminar pelo menos 1h30 antes, para não correr.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="app-step" aria-labelledby="t-step">
            <div className="app-step-head">
              <span className="app-eyebrow">Passo 4 de 5</span>
              <h1 id="t-step" ref={headingRef} tabIndex={-1} className="app-h1">
                Seus <em>dados</em>
              </h1>
              <p className="app-lead">
                Usamos esses dados só para confirmar e organizar o seu atendimento.
              </p>
            </div>
            <div className="app-grid-2 is-wide">
              <div className="app-card">
                <div className="app-form">
                  <div className="app-field-group is-wide">
                    <label htmlFor="b-name">Nome completo</label>
                    <input
                      id="b-name"
                      className="app-field"
                      autoComplete="name"
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      {...invalid('name')}
                    />
                    {fieldErr('name')}
                  </div>
                  <div className="app-field-group">
                    <label htmlFor="b-phone">WhatsApp com DDD</label>
                    <input
                      id="b-phone"
                      className="app-field"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="(DDD) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(formatBrazilianPhone(e.target.value))}
                      {...invalid('phone')}
                    />
                    {fieldErr('phone')}
                  </div>
                  <div className="app-field-group">
                    <label htmlFor="b-email">E-mail</label>
                    <input
                      id="b-email"
                      className="app-field"
                      type="email"
                      autoComplete="email"
                      maxLength={200}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      {...invalid('email')}
                    />
                    {fieldErr('email')}
                  </div>
                  <div className="app-field-group is-wide">
                    <label htmlFor="b-look">Referência de look e tipo de pele (opcional)</label>
                    <textarea
                      id="b-look"
                      className="app-field"
                      rows={3}
                      maxLength={1000}
                      placeholder="Ex.: pele mista, make iluminada com olho marcado"
                      value={lookNotes}
                      onChange={(e) => setLookNotes(e.target.value)}
                    />
                  </div>
                  <div className="app-field-group is-wide">
                    <label htmlFor="b-allergy">Alergias ou sensibilidades (opcional)</label>
                    <textarea
                      id="b-allergy"
                      className="app-field"
                      rows={2}
                      maxLength={1000}
                      value={allergyNotes}
                      onChange={(e) => setAllergyNotes(e.target.value)}
                    />
                    {allergyNotes.trim() && (
                      <label className="app-check">
                        <input
                          id="b-allergyConsent"
                          type="checkbox"
                          checked={allergyConsent}
                          onChange={(e) => setAllergyConsent(e.target.checked)}
                          {...invalid('allergyConsent')}
                        />
                        <span>
                          Autorizo a Luísa a registrar essas informações de saúde, só para cuidar da
                          minha pele no atendimento. Elas são guardadas protegidas e apagadas 30
                          dias depois.
                        </span>
                      </label>
                    )}
                    {fieldErr('allergyConsent')}
                  </div>
                </div>
              </div>
              {summary}
            </div>
          </section>
        )}

        {step === 5 && service && quote && date && time && (
          <section className="app-step" aria-labelledby="t-step">
            <div className="app-step-head">
              <span className="app-eyebrow">Passo 5 de 5</span>
              <h1 id="t-step" ref={headingRef} tabIndex={-1} className="app-h1">
                Revise e <em>confirme</em>
              </h1>
            </div>
            {submitError && (
              <div className="app-notice is-error" role="alert">
                <Alert size={20} />
                <span>
                  {submitError === 'network' ? (
                    <>
                      <strong>Não conseguimos confirmar agora</strong>
                      Pode ter sido uma instabilidade na conexão. Seus dados estão salvos: é só
                      tentar de novo.
                    </>
                  ) : (
                    submitError
                  )}
                </span>
              </div>
            )}
            <div className="app-grid-2 is-wide">
              <div className="app-card">
                <h2>Resumo do agendamento</h2>
                <dl className="app-review">
                  {[
                    {
                      k: 'Serviço',
                      v: `${service.name} · ${formatDuration(service.durationMin)}`,
                      to: 1,
                    },
                    { k: 'Data e horário', v: `${formatDateLong(date)}, às ${time}`, to: 3 },
                    {
                      k: 'Evento',
                      v: `Começa às ${eventStart} · ${eventDurationLabel(eventDuration).toLowerCase()}`,
                      to: 2,
                    },
                    {
                      k: 'Local',
                      v: `${quote.addressLine}${quote.complement ? ` · ${quote.complement}` : ''}`,
                      to: 2,
                    },
                    { k: 'Seus dados', v: `${name} · ${phone} · ${email}`, to: 4 },
                  ].map((row) => (
                    <div key={row.k}>
                      <dt>{row.k}</dt>
                      <dd>{row.v}</dd>
                      <button
                        type="button"
                        className="app-link"
                        onClick={() => go(row.to)}
                        aria-label={`Editar ${row.k}`}
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col gap-4">
                <aside className="app-summary" aria-label="Valores">
                  <span>Valor estimado</span>
                  <dl>
                    <div>
                      <dt>Maquiagem</dt>
                      <dd>{formatMoney(service.priceCents)}</dd>
                    </div>
                    <div>
                      <dt>Deslocamento</dt>
                      <dd>{formatMoney(quote.feeCents)}</dd>
                    </div>
                    <div className="is-total">
                      <dt>Total</dt>
                      <dd>{formatMoney(total)}</dd>
                    </div>
                  </dl>
                  {/* TODO(Leo): forma e momento do pagamento (contrato, Fase 4b). */}
                  <span className="text-sm text-[#D9C7B2]">
                    Forma de pagamento combinada com a Luísa na confirmação.
                  </span>
                </aside>
                <label className="app-check">
                  <input
                    type="checkbox"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                  />
                  <span>
                    Li e aceito a política de cancelamento: cancelamentos e remarcações pelo site
                    até 48 horas antes do horário da maquiagem.
                  </span>
                </label>
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="app-bar">
        <div className="app-wrap">
          {step > 1 ? (
            <button type="button" className="app-btn app-btn-ghost" onClick={() => go(step - 1)}>
              <ChevronLeft size={18} />
              Voltar
            </button>
          ) : (
            <span className="app-bar-hint hidden tablet:inline">
              {service ? `${service.name} selecionada` : 'Selecione um serviço para continuar'}
            </span>
          )}
          <button
            type="button"
            className="app-btn app-btn-gold"
            onClick={() => void next()}
            disabled={!canContinue}
            aria-busy={submitting}
          >
            {step < 5 ? (
              <>
                Continuar
                <ArrowRight size={18} />
              </>
            ) : submitting ? (
              'Confirmando…'
            ) : submitError === 'network' ? (
              'Tentar de novo'
            ) : (
              'Confirmar agendamento'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
