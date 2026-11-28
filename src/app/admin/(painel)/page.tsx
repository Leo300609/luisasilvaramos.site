import type { Metadata } from 'next'
import Link from 'next/link'

import { StatusChip } from '@/components/admin/status'
import { formatDateLong, formatMoney } from '@/lib/format'
import { dashboardStats } from '@/server/admin/agenda'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import { minutesToTime, todayLocal } from '@/server/scheduling/time'

export const metadata: Metadata = { title: 'Início' }

export default async function DashboardPage() {
  const { user } = await requireAdmin()
  const now = new Date()
  const stats = await dashboardStats(getDb(), now)
  const today = todayLocal(now)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', timeZone: 'America/Sao_Paulo' }).format(
      now,
    ),
  )
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const first = user.name.split(' ')[0]

  const cards = [
    { label: 'Hoje', value: String(stats.today.length).padStart(2, '0'), note: 'atendimentos' },
    {
      label: 'Esta semana',
      value: String(stats.weekCount).padStart(2, '0'),
      note: 'de segunda a domingo',
    },
    {
      label: 'Pendentes',
      value: String(stats.pendingCount).padStart(2, '0'),
      note: 'aguardando sua confirmação',
      href: '/admin/agendamentos?status=pendente' as const,
    },
    {
      label: 'Previsto no mês',
      value: formatMoney(stats.monthForecastCents),
      note: 'confirmados e concluídos',
    },
  ]

  return (
    <>
      <div>
        <p className="adm-hello">
          {greeting}, {first}!
        </p>
        <p className="adm-sub">{formatDateLong(today)}</p>
      </div>

      <section className="adm-stats" aria-label="Resumo">
        {cards.map((c) => {
          const body = (
            <>
              <span className="adm-label">{c.label}</span>
              <span className="adm-stat-value">{c.value}</span>
              <span className="adm-small">{c.note}</span>
            </>
          )
          return c.href ? (
            <Link key={c.label} href={c.href} className="adm-stat is-link">
              {body}
            </Link>
          ) : (
            <div key={c.label} className="adm-stat">
              {body}
            </div>
          )
        })}
      </section>

      <div className="adm-two">
        <section className="adm-panel adm-pad" aria-labelledby="h-hoje">
          <div className="adm-section-head">
            <h2 id="h-hoje" className="adm-h2">
              Hoje
            </h2>
            <Link href="/admin/agenda?view=dia" className="adm-link">
              Ver agenda
            </Link>
          </div>
          {stats.today.length === 0 ? (
            <p className="adm-sub">Nenhum atendimento hoje.</p>
          ) : (
            <ol className="adm-day-list">
              {stats.today.map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/agendamentos/${i.id}`} className="adm-day-item">
                    <span className="adm-day-time">{minutesToTime(i.startMin)}</span>
                    <span className="adm-day-main">
                      <strong>{i.customerName}</strong>
                      <span className="adm-small">
                        {i.serviceName}
                        {i.eventStart ? ` · evento ${i.eventStart}` : ''} · saída{' '}
                        {minutesToTime(i.busyStartMin)}
                      </span>
                    </span>
                    <StatusChip status={i.status} />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="adm-panel adm-pad" aria-labelledby="h-pend">
          <div className="adm-section-head">
            <h2 id="h-pend" className="adm-h2">
              Aguardando confirmação
            </h2>
            <Link href="/admin/agendamentos?status=pendente" className="adm-link">
              Ver todos
            </Link>
          </div>
          {stats.nextPending.length === 0 ? (
            <p className="adm-sub">Nenhum pedido pendente. Tudo em dia!</p>
          ) : (
            <ol className="adm-day-list">
              {stats.nextPending.map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/agendamentos/${i.id}`} className="adm-day-item">
                    <span className="adm-day-time">{minutesToTime(i.startMin)}</span>
                    <span className="adm-day-main">
                      <strong>{i.customerName}</strong>
                      <span className="adm-small">
                        {formatDateLong(i.date)} · {i.serviceName}
                      </span>
                    </span>
                    <span className="adm-small">{i.code}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}
