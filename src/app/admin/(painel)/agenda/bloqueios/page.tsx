import { and, gt } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'

import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import * as schema from '@/server/db/schema'
import { addMinutes, todayLocal } from '@/server/scheduling/time'

import { deleteBlockAction } from '../../actions'
import { BlockForm } from './block-form'

export const metadata: Metadata = { title: 'Bloqueios' }

const fmt = (d: Date, withTime: boolean) =>
  new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'America/Sao_Paulo',
  }).format(d)

export default async function BlocksPage() {
  await requireAdmin()
  const now = new Date()
  const rows = await getDb()
    .select()
    .from(schema.blocks)
    .where(and(gt(schema.blocks.endsAt, now)))
    .orderBy(schema.blocks.startsAt)

  return (
    <>
      <Link href="/admin/agenda" className="adm-link adm-back">
        ‹ Voltar para a agenda
      </Link>
      <div className="adm-two">
        <section className="adm-panel adm-pad" aria-labelledby="h-novo-bloq">
          <h2 id="h-novo-bloq" className="adm-h2">
            Novo bloqueio
          </h2>
          <p className="adm-sub">
            Folgas, viagens ou compromissos. Nesses horários o site não oferece atendimento.
          </p>
          <BlockForm today={todayLocal(now)} />
        </section>
        <section className="adm-panel adm-pad" aria-labelledby="h-bloqs">
          <h2 id="h-bloqs" className="adm-h2">
            Próximos bloqueios
          </h2>
          {rows.length === 0 ? (
            <p className="adm-sub">Nenhum bloqueio futuro.</p>
          ) : (
            <ul className="adm-day-list">
              {rows.map((b) => (
                <li key={b.id} className="adm-day-item">
                  <span className="adm-day-main">
                    <strong>{b.reason || 'Bloqueio'}</strong>
                    <span className="adm-small">
                      {b.allDay
                        ? `${fmt(b.startsAt, false)} a ${fmt(addMinutes(b.endsAt, -1), false)} · dia inteiro`
                        : `${fmt(b.startsAt, true)} às ${fmt(b.endsAt, true).split(' ').pop()}`}
                    </span>
                  </span>
                  <form action={deleteBlockAction.bind(null, b.id)}>
                    <button
                      type="submit"
                      className="adm-btn adm-btn-line"
                      aria-label={`Remover bloqueio ${b.reason}`}
                    >
                      Remover
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
