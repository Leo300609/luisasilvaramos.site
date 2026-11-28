import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusChip } from '@/components/admin/status'
import { whatsappLink } from '@/lib/contact'
import { formatDateShort, formatMoney } from '@/lib/format'
import { getCustomer } from '@/server/admin/customers'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import { getKeyRing } from '@/server/runtime'

import { CustomerNotes, ForgetCustomer } from './customer-actions'

export const metadata: Metadata = { title: 'Cliente' }

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ feito?: string }>
}) {
  await requireAdmin()
  const [{ id }, { feito }] = await Promise.all([params, searchParams])
  const c = await getCustomer(getDb(), id, getKeyRing())
  if (!c) notFound()
  const digits = c.phone.replace(/\D/g, '')
  const phoneDisplay = digits
    .replace(/^55(?=\d{10,11}$)/, '')
    .replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')

  return (
    <article className="adm-detail" aria-labelledby="cl-name">
      <Link href="/admin/clientes" className="adm-link adm-back">
        ‹ Voltar para clientes
      </Link>
      {feito === 'removida' && (
        <div role="status" className="adm-alert adm-alert-ok">
          <strong>Dados apagados.</strong> Ficaram só datas, serviços e valores, para a
          contabilidade.
        </div>
      )}
      <div className="adm-detail-card">
        <div className="adm-detail-body">
          <div>
            <h2 id="cl-name" className="adm-detail-name">
              {c.name}
            </h2>
            <span className="adm-sub">
              Cliente desde{' '}
              {new Intl.DateTimeFormat('pt-BR', {
                month: 'long',
                year: 'numeric',
                timeZone: 'America/Sao_Paulo',
              }).format(new Date(c.createdAt))}
            </span>
          </div>
          {!c.anonymized && (
            <div className="adm-contact">
              <a
                className="adm-btn adm-btn-dark"
                href={whatsappLink(`Olá, ${c.name.split(' ')[0]}! Aqui é a Luísa.`, digits)}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp · {phoneDisplay}
              </a>
              {c.email && (
                <a className="adm-btn adm-btn-line" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              )}
            </div>
          )}
          <div className="adm-money">
            <div>
              <span className="adm-label">Agendamentos</span>
              <span className="is-strong">{c.stats.total}</span>
            </div>
            <div>
              <span className="adm-label">Concluídos</span>
              <span className="is-strong">{c.stats.done}</span>
            </div>
            <div>
              <span className="adm-label">Faltas</span>
              <span className="is-strong">{c.stats.noShow}</span>
            </div>
          </div>
          <p className="adm-sub">
            Total em atendimentos concluídos: {formatMoney(c.stats.spentCents)}
          </p>

          {!c.anonymized && <CustomerNotes customerId={c.id} initial={c.notes} />}

          <section className="adm-block" aria-labelledby="cl-hist">
            <h3 id="cl-hist" className="adm-label">
              Histórico
            </h3>
            <ul className="adm-day-list">
              {c.bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/agendamentos/${b.id}`} className="adm-day-item">
                    <span className="adm-day-main">
                      <strong>
                        {formatDateShort(b.date)} · {b.time}
                      </strong>
                      <span className="adm-small">
                        {b.code} · {b.serviceName} · {formatMoney(b.totalCents)}
                      </span>
                    </span>
                    <StatusChip status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {!c.anonymized && (
            <section className="adm-block adm-lgpd" aria-labelledby="cl-lgpd">
              <h3 id="cl-lgpd" className="adm-label">
                Dados pessoais (LGPD)
              </h3>
              <p className="adm-small">
                Se a cliente pedir uma cópia dos dados dela, baixe o arquivo e envie para ela. Se
                pedir para apagar, use o botão abaixo: nome, contato, endereços e observações são
                removidos; ficam só datas, serviços e valores.
              </p>
              <div className="adm-contact">
                <a
                  className="adm-btn adm-btn-line"
                  href={`/admin/clientes/${c.id}/exportar`}
                  download
                >
                  Baixar dados da cliente
                </a>
                <ForgetCustomer customerId={c.id} name={c.name} />
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
