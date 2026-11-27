'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Alert, CheckCircle, Close, WhatsApp } from '@/components/site/icons'
import { whatsappLink } from '@/lib/contact'
import {
  eventDurationLabel,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatMoney,
  todayInSaoPaulo,
} from '@/lib/format'
import type { ClientBookingView } from '@/server/booking/manage'

type Slot = { time: string; fit: 'recommended' | 'ok' | 'tight' }

const STATUS_LABEL: Record<ClientBookingView['status'], string> = {
  pendente: 'Aguardando confirmação',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

async function post<T>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; data: T & { error?: string; message?: string } }> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    return { ok: r.ok, data: (await r.json().catch(() => ({}))) as T & { error?: string } }
  } catch {
    return { ok: false, data: { error: 'network' } as T & { error?: string } }
  }
}

export function MyBooking({
  booking,
  justCreated,
  googleCalendarUrl,
}: {
  booking: ClientBookingView
  justCreated: boolean
  googleCalendarUrl: string
}) {
  const router = useRouter()
  const cancelRef = useRef<HTMLDialogElement>(null)
  const reagRef = useRef<HTMLDialogElement>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reagDate, setReagDate] = useState('')
  const [reagSlots, setReagSlots] = useState<Slot[] | null>(null)
  const [reagTime, setReagTime] = useState<string | null>(null)

  const first = booking.customer.name.split(' ')[0]
  const cancelled = booking.status === 'cancelado'
  const pending = booking.status === 'pendente'
  const title = cancelled
    ? 'Agendamento cancelado'
    : pending
      ? justCreated
        ? 'Pedido recebido!'
        : 'Aguardando confirmação'
      : 'Agendamento confirmado!'
  const text = cancelled
    ? `Tudo certo, ${first}. Quando quiser, é só agendar um novo horário.`
    : pending
      ? `Obrigada, ${first}! A Luísa vai confirmar o seu horário em breve pelo WhatsApp.`
      : `Obrigada, ${first}. Estamos ansiosas para te deixar linda!`

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function doCancel() {
    setBusy(true)
    setError(null)
    const r = await post('/api/agendamento/minha/cancelar', {})
    setBusy(false)
    cancelRef.current?.close()
    if (r.ok) {
      notify('Agendamento cancelado.')
      router.refresh()
    } else setError(r.data.message ?? 'Não conseguimos cancelar agora. Tente de novo.')
  }

  async function loadReagSlots(date: string) {
    setReagDate(date)
    setReagTime(null)
    setReagSlots(null)
    const r = await post<{ slots: Slot[] }>('/api/agendamento/minha/horarios', { date })
    setReagSlots(r.ok ? r.data.slots : [])
  }

  async function doReschedule() {
    if (!reagDate || !reagTime) return
    setBusy(true)
    setError(null)
    const r = await post('/api/agendamento/minha/reagendar', { date: reagDate, time: reagTime })
    setBusy(false)
    if (r.ok) {
      reagRef.current?.close()
      notify(`Horário alterado para ${formatDateShort(reagDate)}, às ${reagTime}.`)
      router.refresh()
    } else if (r.data.error === 'slot-taken') {
      setError('Esse horário acabou de ser reservado. Escolha outro.')
      void loadReagSlots(reagDate)
    } else setError(r.data.message ?? 'Não conseguimos reagendar agora. Tente de novo.')
  }

  const waText = `Olá, Luísa! Sou ${booking.customer.name}, agendamento ${booking.code} (${formatDateShort(booking.date)}, às ${booking.time}).`

  return (
    <main id="conteudo" className="app-main flex flex-col gap-6">
      <section className="app-hero-ok" role="status" aria-labelledby="t-ok">
        <span
          className={`app-check-circle ${cancelled ? 'is-cancelled' : pending ? 'is-pending' : ''}`}
          aria-hidden="true"
        >
          {cancelled ? <Close size={34} /> : <CheckCircle size={38} />}
        </span>
        <div>
          <h1 id="t-ok">{title}</h1>
          <p>{text}</p>
        </div>
      </section>

      {error && (
        <div className="app-notice is-error" role="alert">
          <Alert size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="app-grid-2 is-wide">
        <article className="app-card flex flex-col gap-6" aria-labelledby="t-dados">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="t-dados">Dados do seu agendamento</h2>
            <div className="flex items-center gap-3">
              <span className="font-semibold tracking-wider">#{booking.code}</span>
              <span className="app-status" data-status={booking.status}>
                {STATUS_LABEL[booking.status]}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="app-eyebrow">{booking.serviceName}</span>
            <span className="app-big-date">{formatDateLong(booking.date)}</span>
            <span className="flex flex-wrap items-baseline gap-3">
              <span className="app-big-time">{booking.time}</span>
              <span className="text-brown">
                Duração aproximada: {formatDuration(booking.durationMin)}
              </span>
            </span>
          </div>
          <dl className="app-review">
            {booking.eventStart && (
              <div>
                <dt>Seu evento</dt>
                <dd>
                  Começa às {booking.eventStart}
                  {booking.eventDuration
                    ? ` · ${eventDurationLabel(booking.eventDuration).toLowerCase()}`
                    : ''}
                </dd>
              </div>
            )}
            <div>
              <dt>Local</dt>
              <dd>
                {booking.address}
                {booking.complement ? ` · ${booking.complement}` : ''}
              </dd>
            </div>
            <div>
              <dt>Valor estimado</dt>
              <dd>
                {formatMoney(booking.totalCents)} ({formatMoney(booking.priceCents)} + deslocamento{' '}
                {formatMoney(booking.travelFeeCents)})
              </dd>
            </div>
            <div>
              <dt>Observações</dt>
              <dd>{booking.lookNotes || 'Nenhuma observação'}</dd>
            </div>
            <div>
              <dt>Seus contatos</dt>
              <dd>
                {booking.customer.name} · {booking.customer.email}
              </dd>
            </div>
          </dl>
        </article>

        <div className="flex flex-col gap-4">
          <div className="app-card app-actions">
            {!cancelled && (
              <>
                <a
                  className="app-btn app-btn-gold"
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Adicionar ao Google Agenda
                </a>
                <div className="app-actions-3">
                  <a className="app-btn app-btn-out" href="/api/agendamento/minha/ics" download>
                    Apple
                  </a>
                  <a className="app-btn app-btn-out" href="/api/agendamento/minha/ics" download>
                    Outlook
                  </a>
                  <a className="app-btn app-btn-out" href="/api/agendamento/minha/ics" download>
                    Arquivo .ics
                  </a>
                </div>
              </>
            )}
            <a
              className="app-btn app-btn-dark"
              href={whatsappLink(waText)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsApp size={18} />
              Falar com a Luísa no WhatsApp
            </a>
            {!cancelled && (
              <>
                <button
                  type="button"
                  className="app-btn app-btn-out"
                  disabled={!booking.canChange}
                  onClick={() => {
                    setError(null)
                    reagRef.current?.showModal()
                  }}
                >
                  Reagendar
                </button>
                <button
                  type="button"
                  className="app-link self-center"
                  disabled={!booking.canChange}
                  onClick={() => {
                    setError(null)
                    cancelRef.current?.showModal()
                  }}
                >
                  Cancelar agendamento
                </button>
                {!booking.canChange && (
                  <p className="m-0 text-sm text-brown">
                    Alterações pelo site só até 48 horas antes. Para mudar agora, fale com a Luísa
                    pelo WhatsApp.
                  </p>
                )}
              </>
            )}
            <Link className="app-link self-center" href="/">
              Voltar ao site
            </Link>
          </div>
        </div>
      </div>

      <div className="app-grid-2">
        <section className="app-card" aria-labelledby="t-pp">
          <h2 id="t-pp">Próximos passos</h2>
          <ol className="m-0 flex list-decimal flex-col gap-3 pl-5 text-brown">
            <li>
              <strong className="text-espresso">Confirmação pelo WhatsApp.</strong> A Luísa confirma
              os detalhes e a forma de pagamento.
            </li>
            <li>
              <strong className="text-espresso">Preparação.</strong> Envie fotos de referência e do
              seu look. Na véspera você recebe um lembrete.
            </li>
            <li>
              <strong className="text-espresso">O dia da maquiagem.</strong> Esteja no local no
              horário combinado, com o rosto limpo. O resto é com a gente.
            </li>
          </ol>
        </section>
        <section className="app-card" aria-labelledby="t-dicas">
          <h2 id="t-dicas">Dicas para o seu dia</h2>
          <ul className="m-0 flex list-disc flex-col gap-3 pl-5 text-brown">
            <li>Hidrate a pele: beba bastante água e use hidratante na noite anterior.</li>
            <li>Durma bem: a pele descansada deixa a make mais bonita.</li>
            <li>Vista uma blusa de botão, para trocar de roupa sem encostar na maquiagem.</li>
          </ul>
        </section>
      </div>

      <dialog ref={cancelRef} className="app-modal" aria-labelledby="m-cancel">
        <h2 id="m-cancel">Cancelar agendamento?</h2>
        <p className="m-0 text-brown">
          {booking.serviceName} em {formatDateShort(booking.date)}, às {booking.time}. O horário
          volta a ficar disponível para outras clientes.
        </p>
        <div className="app-modal-actions">
          <button
            type="button"
            className="app-btn app-btn-terra"
            onClick={() => void doCancel()}
            disabled={busy}
          >
            {busy ? 'Cancelando…' : 'Sim, cancelar'}
          </button>
          <button
            type="button"
            className="app-btn app-btn-out"
            onClick={() => cancelRef.current?.close()}
          >
            Manter agendamento
          </button>
        </div>
      </dialog>

      <dialog ref={reagRef} className="app-modal" aria-labelledby="m-reag">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="m-reag">Reagendar horário</h2>
            <p className="m-0 text-brown">
              Atual: {formatDateShort(booking.date)}, às {booking.time}
            </p>
          </div>
          <button
            type="button"
            className="app-btn app-btn-ghost !px-3"
            aria-label="Fechar"
            onClick={() => reagRef.current?.close()}
          >
            <Close size={20} />
          </button>
        </div>
        <div className="app-field-group mt-5">
          <label htmlFor="r-date">Nova data</label>
          <input
            id="r-date"
            type="date"
            className="app-field"
            min={todayInSaoPaulo()}
            value={reagDate}
            onChange={(e) => e.target.value && void loadReagSlots(e.target.value)}
          />
        </div>
        {reagDate && (
          <div className="mt-4 flex flex-col gap-3">
            <span className="app-eyebrow">Horários</span>
            {reagSlots === null && (
              <span className="app-skel h-14" aria-label="Carregando horários" />
            )}
            {reagSlots?.length === 0 && (
              <p className="m-0 text-brown">Sem horários livres nesse dia.</p>
            )}
            {reagSlots && reagSlots.length > 0 && (
              <div className="app-slots" role="radiogroup" aria-label="Novos horários">
                {reagSlots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    role="radio"
                    className="app-slot"
                    aria-checked={s.time === reagTime}
                    onClick={() => setReagTime(s.time)}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="app-modal-actions">
          <button
            type="button"
            className="app-btn app-btn-gold w-full"
            disabled={!reagTime || busy}
            onClick={() => void doReschedule()}
          >
            {busy ? 'Salvando…' : 'Confirmar novo horário'}
          </button>
        </div>
      </dialog>

      {toast && (
        <div className="app-toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}
