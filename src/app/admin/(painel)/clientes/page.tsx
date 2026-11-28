import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { listCustomers, CUSTOMERS_PAGE } from '@/server/admin/customers'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'

export const metadata: Metadata = { title: 'Clientes' }

const phoneDisplay = (p: string) =>
  p
    .replace(/\D/g, '')
    .replace(/^55(?=\d{10,11}$)/, '')
    .replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const q = (params.q ?? '').slice(0, 100)
  const page = Math.max(1, Number.parseInt(params.pagina ?? '1', 10) || 1)
  const { rows, total } = await listCustomers(getDb(), { q, page })
  const pages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE))
  const pageHref = (n: number) =>
    `/admin/clientes?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(n) })}` as Route

  return (
    <>
      <form className="adm-filters" role="search" aria-label="Buscar clientes">
        <label className="adm-search">
          <span className="sr-only">Buscar por nome, e-mail ou telefone</span>
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
            placeholder="Nome, e-mail ou telefone"
            maxLength={100}
          />
        </label>
        <button type="submit" className="adm-btn adm-btn-out">
          Buscar
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="adm-empty">
          <strong>{q ? `Nenhuma cliente para “${q}”` : 'Nenhuma cliente ainda'}</strong>
          <span>As clientes aparecem aqui depois do primeiro agendamento.</span>
        </div>
      ) : (
        <section className="adm-panel" aria-label="Lista de clientes">
          <ul className="adm-cards adm-cards-always">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clientes/${c.id}`} className="adm-card-row">
                  <span className="adm-card-name">{c.name}</span>
                  <span className="adm-card-meta">
                    <span>{phoneDisplay(c.phone)}</span>
                    {c.email && <span>{c.email}</span>}
                    <span className="is-strong">
                      {c.bookings} {c.bookings === 1 ? 'agendamento' : 'agendamentos'}
                    </span>
                    {c.lastAt && (
                      <span>
                        último:{' '}
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          timeZone: 'America/Sao_Paulo',
                        }).format(new Date(c.lastAt))}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="adm-panel-foot">
            <span>
              {total} {total === 1 ? 'cliente' : 'clientes'}
            </span>
            {pages > 1 && (
              <nav aria-label="Paginação" className="adm-pager">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} aria-label="Página anterior">
                    ‹
                  </Link>
                ) : (
                  <span aria-hidden="true">‹</span>
                )}
                <span aria-current="page">
                  {page} / {pages}
                </span>
                {page < pages ? (
                  <Link href={pageHref(page + 1)} aria-label="Próxima página">
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
