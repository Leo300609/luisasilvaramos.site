import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusChip } from '@/components/admin/status'
import { whatsappLink } from '@/lib/contact'
import { eventDurationLabel, formatDateLong, formatDuration, formatMoney } from '@/lib/format'
import { getAdminBooking } from '@/server/admin/bookings'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import { getKeyRing } from '@/server/runtime'

import { BookingActions } from './booking-actions'

export const metadata: Metadata = { title: 'Agendamento' }

const EVENT_LABEL: Record<string, string> = {
  created: 'Pedido feito pelo site',
  confirmed: 'Confirmado no painel',
  declined: 'Recusado no painel',
  cancelled: 'Cancelado pela cliente',
  rescheduled: 'Remarcado pela cliente',
}

const CANCEL_LABEL: Record<string, string> = {
  pedido_cliente: 'a pedido da cliente',
  recusado: 'recusado por você',
  imprevisto_maquiadora: 'imprevisto da maquiadora',
  nao_compareceu: 'cliente não compareceu',
  expirado: 'prazo de confirmação vencido',
  outro: 'outro motivo',
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ feito?: string }>
}) {
  await requireAdmin()
  const [{ id }, { feito }] = await Promise.all([params, searchParams])
  const b = await getAdminBooking(getDb(), id, getKeyRing())
  if (!b) notFound()

  const first = b.customerName.split(' ')[0]
  const wa = whatsappLink(
    `Olá, ${first}! Aqui é a Luísa, sobre o seu agendamento ${b.code}.`,
    b.phone.replace(/\D/g, ''),
  )
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`
  const phoneDisplay = b.phone
    .replace(/\D/g, '')
    .replace(/^55(?=\d{10,11}$)/, '')
    .replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')

  return (
    <article className="adm-detail" aria-labelledby="dt-name">
      <Link href="/admin/agendamentos" className="adm-link adm-back">
        ‹ Voltar para a lista
      </Link>

      {feito === 'confirmado' && (
        <div role="status" className="adm-alert adm-alert-ok">
          <strong>Agendamento confirmado.</strong> A cliente recebe a confirmação por e-mail.
        </div>
      )}
      {feito === 'recusado' && (
        <div role="status" className="adm-alert adm-alert-warn">
          <strong>Pedido recusado.</strong> O horário foi liberado e a cliente foi avisada por
          e-mail.
        </div>
      )}

      <div className="adm-detail-card">
        <header className="adm-detail-head">
          <span className="adm-code">{b.code}</span>
          <StatusChip status={b.status} />
          {b.status === 'cancelado' && b.cancelReason && (
            <span className="adm-small">{CANCEL_LABEL[b.cancelReason] ?? b.cancelReason}</span>
          )}
        </header>

        <div className="adm-detail-body">
          <div>
            <h2
              id="dt-name"
              className={`adm-detail-name${b.status === 'cancelado' ? 'is-cancelled' : ''}`}
            >
              {b.customerName}
            </h2>
            <span className="adm-sub">
              {b.serviceName} · {formatDuration(b.durationMin)}
            </span>
          </div>

          <div className="adm-contact">
            <a className="adm-btn adm-btn-dark" href={wa} target="_blank" rel="noopener noreferrer">
              WhatsApp · {phoneDisplay}
            </a>
            <a className="adm-btn adm-btn-line" href={`mailto:${b.email}`}>
              E-mail
            </a>
          </div>

          <dl className="adm-info">
            <div>
              <dt>Data</dt>
              <dd>{formatDateLong(b.date)}</dd>
            </div>
            <div>
              <dt>Horário</dt>
              <dd>
                {b.time} às {b.endTime}
              </dd>
            </div>
            <div>
              <dt>Evento</dt>
              <dd>
                {b.eventStart ?? '–'}
                {b.eventDuration ? ` · ${eventDurationLabel(b.eventDuration)}` : ''}
              </dd>
            </div>
            <div>
              <dt>Deslocamento</dt>
              <dd>
                {b.travelToMin} min ida · {b.travelBackMin} min volta
                {b.distanceKm ? ` · ${b.distanceKm.replace('.', ',')} km` : ''}
              </dd>
            </div>
          </dl>

          <section className="adm-block" aria-labelledby="dt-local">
            <h3 id="dt-local" className="adm-label">
              Local
            </h3>
            <div className="adm-place">
              <span>
                {b.address}
                {b.complement && <span className="adm-small">{b.complement}</span>}
              </span>
              <a
                className="adm-btn adm-btn-line"
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no mapa
              </a>
            </div>
          </section>

          <div className="adm-money">
            <div>
              <span className="adm-label">Serviço</span>
              <span>{formatMoney(b.priceCents)}</span>
            </div>
            <div>
              <span className="adm-label">Deslocamento</span>
              <span>{formatMoney(b.travelFeeCents)}</span>
            </div>
            <div>
              <span className="adm-label">Total</span>
              <span className="is-strong">{formatMoney(b.totalCents)}</span>
            </div>
          </div>

          {b.lookNotes && (
            <section className="adm-block" aria-labelledby="dt-look">
              <h3 id="dt-look" className="adm-label">
                Observações da cliente
              </h3>
              <p className="adm-note">{b.lookNotes}</p>
            </section>
          )}
          {b.allergyNotes && (
            <section className="adm-block" aria-labelledby="dt-allergy">
              <h3 id="dt-allergy" className="adm-label">
                Alergias e sensibilidades (dado de saúde)
              </h3>
              <p className="adm-note is-health">{b.allergyNotes}</p>
            </section>
          )}

          <section className="adm-block" aria-labelledby="dt-hist">
            <h3 id="dt-hist" className="adm-label">
              Histórico
            </h3>
            <ol className="adm-timeline">
              {b.events.map((e, i) => (
                <li key={i}>
                  <span>{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span className="adm-small">{when(e.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {b.status === 'pendente' && (
          <BookingActions bookingId={b.id} customerFirstName={first ?? ''} />
        )}
      </div>
    </article>
  )
}
