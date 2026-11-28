import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { StatusChip, STATUS_LABEL } from '@/components/admin/status'
import { whatsappLink } from '@/lib/contact'
import { eventDurationLabel, formatDateShort, formatMoney } from '@/lib/format'
import {
  listBookings,
  PAGE_SIZE,
  STATUS_FILTERS,
  type AdminBookingRow,
  type StatusFilter,
} from '@/server/admin/bookings'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'

export const metadata: Metadata = { title: 'Agendamentos' }

type Search = { status?: string; q?: string; pagina?: string }

function expiresLabel(iso: string | null): string | null {
  if (!iso) return null
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
  if (hours <= 0) return 'prazo de confirmação vencido'
  return hours === 1 ? 'expira em 1 h' : `expira em ${hours} h`
}

function pageHref(params: Search, page: number): Route {
  const q = new URLSearchParams()
  if (params.status && params.status !== 'todos') q.set('status', params.status)
  if (params.q) q.set('q', params.q)
  if (page > 1) q.set('pagina', String(page))
  const s = q.toString()
  return `/admin/agendamentos${s ? `?${s}` : ''}` as Route
}

function waLink(row: AdminBookingRow) {
  return whatsappLink(
    `Olá, ${row.customerName.split(' ')[0]}! Aqui é a Luísa, sobre o seu agendamento ${row.code}.`,
    row.phone.replace(/\D/g, ''),
  )
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin()
  const params = await searchParams
  const status: StatusFilter = STATUS_FILTERS.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : 'todos'
  const q = (params.q ?? '').slice(0, 100)
  const page = Math.max(1, Number.parseInt(params.pagina ?? '1', 10) || 1)
  const { rows, total } = await listBookings(getDb(), { status, q, page })
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <form className="adm-filters" role="search" aria-label="Filtrar agendamentos">
        <label className="adm-search">
          <span className="sr-only">Buscar por nome, e-mail ou código</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B5444"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou código"
            maxLength={100}
          />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select name="status" defaultValue={status} className="adm-select">
            <option value="todos">Todos os status</option>
            {STATUS_FILTERS.filter((s) => s !== 'todos').map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s as Exclude<StatusFilter, 'todos'>]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="adm-btn adm-btn-out">
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="adm-empty">
          <svg width="88" height="72" viewBox="0 0 88 72" fill="none" aria-hidden="true">
            <ellipse cx="44" cy="42" rx="38" ry="26" fill="#F8DE7E" opacity=".5" />
            <circle cx="40" cy="32" r="16" fill="#FFFDF8" stroke="#C9972B" strokeWidth="1.5" />
            <path d="M52 44l12 12" stroke="#C9972B" strokeWidth="3" strokeLinecap="round" />
            <path d="M34 32h12" stroke="#C9972B" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <strong>{q ? `Nenhum resultado para “${q}”` : 'Nenhum agendamento por aqui'}</strong>
          <span>
            {q || status !== 'todos'
              ? 'Confira a grafia, busque pelo código (ex.: LSR-0001) ou limpe os filtros.'
              : 'Os pedidos feitos pelo site aparecem aqui.'}
          </span>
          {(q || status !== 'todos') && (
            <Link href="/admin/agendamentos" className="adm-btn adm-btn-out">
              Limpar busca e filtros
            </Link>
          )}
        </div>
      ) : (
        <section className="adm-panel" aria-label="Lista de agendamentos">
          <div className="adm-table-wrap">
            <table className="adm-table">
              <caption className="sr-only">Lista de agendamentos</caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Serviço</th>
                  <th scope="col">Data</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Evento</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.status === 'cancelado' ? 'is-cancelled' : undefined}
                  >
                    <td className="is-strong">{row.code}</td>
                    <td className="adm-client">{row.customerName}</td>
                    <td className="is-muted">{row.serviceName}</td>
                    <td className="is-nowrap">{formatDateShort(row.date)}</td>
                    <td className="is-strong">{row.time}</td>
                    <td className="is-nowrap">
                      <span className="is-strong">{row.eventStart ?? '–'}</span>
                      <span className="adm-small">{eventDurationLabel(row.eventDuration)}</span>
                    </td>
                    <td className="is-nowrap">{formatMoney(row.totalCents)}</td>
                    <td>
                      <StatusChip status={row.status} />
                      {row.status === 'pendente' && (
                        <span className="adm-small">{expiresLabel(row.expiresAt)}</span>
                      )}
                    </td>
                    <td className="is-right is-nowrap">
                      <a
                        className="adm-icon-btn"
                        href={waLink(row)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp de ${row.customerName}`}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 11.6a8.2 8.2 0 0 1-12.1 7.2L3.5 20l1.2-4.2A8.2 8.2 0 1 1 20 11.6z" />
                        </svg>
                      </a>
                      <Link
                        className="adm-icon-btn"
                        href={`/admin/agendamentos/${row.id}`}
                        aria-label={`Ver detalhes de ${row.code}`}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="adm-cards">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/agendamentos/${row.id}`} className="adm-card-row">
                  <span className="adm-card-head">
                    <span className="adm-card-code">{row.code}</span>
                    <StatusChip status={row.status} />
                  </span>
                  <span
                    className={`adm-card-name${row.status === 'cancelado' ? 'is-cancelled' : ''}`}
                  >
                    {row.customerName}
                  </span>
                  <span className="adm-card-meta">
                    <span>{row.serviceName}</span>
                    <span className="is-strong">
                      {formatDateShort(row.date)} · {row.time}
                    </span>
                    {row.eventStart && (
                      <span>
                        Evento {row.eventStart}
                        {row.eventDuration ? ` · ${eventDurationLabel(row.eventDuration)}` : ''}
                      </span>
                    )}
                    <span>{formatMoney(row.totalCents)}</span>
                    {row.status === 'pendente' && <span>{expiresLabel(row.expiresAt)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="adm-panel-foot">
            <span>
              Mostrando {rows.length} de {total} agendamentos
            </span>
            {pages > 1 && (
              <nav aria-label="Paginação" className="adm-pager">
                {page > 1 ? (
                  <Link href={pageHref(params, page - 1)} aria-label="Página anterior">
                    ‹
                  </Link>
                ) : (
                  <span aria-hidden="true">‹</span>
                )}
                <span aria-current="page">
                  {page} / {pages}
                </span>
                {page < pages ? (
                  <Link href={pageHref(params, page + 1)} aria-label="Próxima página">
                    ›
                  </Link>
                ) : (
                  <span aria-hidden="true">›</span>
                )}
              </nav>
            )}
          </div>
        </section>
      )}
    </>
  )
}
