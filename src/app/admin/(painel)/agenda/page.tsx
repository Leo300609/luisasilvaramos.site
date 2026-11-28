import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { formatMonth } from '@/lib/format'
import {
  loadAgenda,
  monthGrid,
  weekStart,
  type AgendaBlock,
  type AgendaItem,
} from '@/server/admin/agenda'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import { loadHours } from '@/server/scheduling/context'
import { addDays, minutesToTime, todayLocal, weekdayOf } from '@/server/scheduling/time'

export const metadata: Metadata = { title: 'Agenda' }

type View = 'dia' | 'semana' | 'mes'
const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const PX_PER_HOUR = 56

const isDate = (v?: string): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
const href = (view: View, date: string) => `/admin/agenda?view=${view}&data=${date}` as Route

function dayLabel(date: string) {
  const [, m, d] = date.split('-')
  return `${WD_SHORT[weekdayOf(date)]} ${Number(d)}/${Number(m)}`
}

function rangeLabel(view: View, date: string, from: string, to: string) {
  if (view === 'mes') return formatMonth(date.slice(0, 7))
  if (view === 'dia') return dayLabel(date)
  return `${dayLabel(from)} – ${dayLabel(to)}`
}

function TimeGrid({
  days,
  items,
  blocks,
  startHour,
  endHour,
  today,
}: {
  days: string[]
  items: AgendaItem[]
  blocks: AgendaBlock[]
  startHour: number
  endHour: number
  today: string
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const top = (min: number) => ((min - startHour * 60) / 60) * PX_PER_HOUR
  const height = (a: number, b: number) => Math.max(18, ((b - a) / 60) * PX_PER_HOUR)
  const clip = (min: number) => Math.min(Math.max(min, startHour * 60), endHour * 60)
  return (
    <div className="adm-grid-wrap">
      <div
        className="adm-grid"
        style={{
          gridTemplateColumns: `56px repeat(${days.length}, minmax(${days.length > 1 ? 120 : 220}px, 1fr))`,
        }}
      >
        <div className="adm-grid-corner" />
        {days.map((d) => (
          <div key={d} className={`adm-grid-day${d === today ? 'is-today' : ''}`}>
            <Link href={href('dia', d)}>{dayLabel(d)}</Link>
          </div>
        ))}
        <div className="adm-grid-hours" style={{ height: hours.length * PX_PER_HOUR }}>
          {hours.map((h) => (
            <span key={h} style={{ top: (h - startHour) * PX_PER_HOUR }}>
              {String(h).padStart(2, '0')}h
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div
            key={d}
            className="adm-grid-col"
            style={{ height: hours.length * PX_PER_HOUR, backgroundSize: `100% ${PX_PER_HOUR}px` }}
          >
            {blocks
              .filter((b) => b.date === d)
              .map((b) => (
                <div
                  key={`${b.id}-${d}`}
                  className="adm-ev is-block"
                  style={{
                    top: top(clip(b.startMin)),
                    height: height(clip(b.startMin), clip(b.endMin)),
                  }}
                >
                  <strong>Bloqueado</strong>
                  {b.reason && <span>{b.reason}</span>}
                </div>
              ))}
            {items
              .filter((i) => i.date === d)
              .map((i) => (
                <div key={i.id}>
                  <div
                    className="adm-ev-travel"
                    aria-hidden="true"
                    style={{
                      top: top(clip(i.busyStartMin)),
                      height: height(clip(i.busyStartMin), clip(i.busyEndMin)),
                    }}
                  />
                  <Link
                    href={`/admin/agendamentos/${i.id}`}
                    className={`adm-ev is-${i.status}`}
                    style={{
                      top: top(clip(i.startMin)),
                      height: height(clip(i.startMin), clip(i.endMin)),
                    }}
                  >
                    <strong>
                      {minutesToTime(i.startMin)} {i.customerName}
                    </strong>
                    <span>
                      {i.serviceName}
                      {i.status === 'pendente' ? ' · pendente' : ''}
                    </span>
                    <span className="sr-only">
                      Deslocamento de {minutesToTime(i.busyStartMin)} a{' '}
                      {minutesToTime(i.busyEndMin)}
                    </span>
                  </Link>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; data?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const db = getDb()
  const today = todayLocal(new Date())
  const view: View = params.view === 'dia' || params.view === 'mes' ? params.view : 'semana'
  const date = isDate(params.data) ? params.data : today

  let from: string
  let to: string
  let prev: string
  let next: string
  let days: string[]
  if (view === 'dia') {
    from = to = date
    days = [date]
    prev = addDays(date, -1)
    next = addDays(date, 1)
  } else if (view === 'semana') {
    from = weekStart(date)
    to = addDays(from, 6)
    days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
    prev = addDays(from, -7)
    next = addDays(from, 7)
  } else {
    const grid = monthGrid(date.slice(0, 7))
    from = grid.from
    to = grid.to
    days = grid.days
    const [y, m] = date.split('-').map(Number) as [number, number]
    prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}-01`
    next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  }

  const [{ items, blocks }, hours] = await Promise.all([loadAgenda(db, from, to), loadHours(db)])
  const open = [...hours.values()].filter((h) => h.isOpen)
  const minOpen = Math.min(...open.map((h) => Number(h.opensAt.slice(0, 2))), 8)
  const maxClose = Math.max(
    ...open.map((h) =>
      Math.ceil(Number(h.closesAt.slice(0, 2)) + Number(h.closesAt.slice(3, 5)) / 60),
    ),
    19,
  )
  const startHour = Math.max(
    0,
    Math.min(minOpen, ...items.map((i) => Math.floor(i.busyStartMin / 60))),
  )
  const endHour = Math.min(
    24,
    Math.max(maxClose, ...items.map((i) => Math.ceil(i.busyEndMin / 60))),
  )

  return (
    <>
      <div className="adm-toolbar">
        <div className="adm-seg" role="group" aria-label="Visualização">
          {(['dia', 'semana', 'mes'] as const).map((v) => (
            <Link key={v} href={href(v, date)} aria-current={v === view ? 'page' : undefined}>
              {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
            </Link>
          ))}
        </div>
        <div className="adm-period">
          <Link href={href(view, prev)} className="adm-icon-btn" aria-label="Anterior">
            ‹
          </Link>
          <h2 className="adm-h2">{rangeLabel(view, date, from, to)}</h2>
          <Link href={href(view, next)} className="adm-icon-btn" aria-label="Próximo">
            ›
          </Link>
          <Link href={href(view, today)} className="adm-btn adm-btn-line">
            Hoje
          </Link>
        </div>
        <Link href="/admin/agenda/bloqueios" className="adm-btn adm-btn-out">
          Bloqueios
        </Link>
      </div>

      <p className="adm-legend">
        <span>
          <i className="is-confirmado" /> Confirmado
        </span>
        <span>
          <i className="is-pendente" /> Pendente
        </span>
        <span>
          <i className="is-concluido" /> Concluído
        </span>
        <span>
          <i className="is-travel" /> Deslocamento e intervalo
        </span>
        <span>
          <i className="is-block" /> Bloqueado
        </span>
      </p>

      {view === 'mes' ? (
        <div className="adm-month">
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((w) => (
            <div key={w} className="adm-month-wd" aria-hidden="true">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const dayItems = items.filter((i) => i.date === d)
            const blocked = blocks.some((b) => b.date === d && b.allDay)
            const outside = d.slice(0, 7) !== date.slice(0, 7)
            return (
              <Link
                key={d}
                href={href('dia', d)}
                className={`adm-month-day${outside ? 'is-outside' : ''}${d === today ? 'is-today' : ''}${blocked ? 'is-blocked' : ''}`}
                aria-label={`${dayLabel(d)}: ${dayItems.length} atendimento(s)${blocked ? ', bloqueado' : ''}`}
              >
                <span className="adm-month-num">{Number(d.slice(8))}</span>
                {dayItems.slice(0, 3).map((i) => (
                  <span key={i.id} className={`adm-month-ev is-${i.status}`}>
                    {minutesToTime(i.startMin)} {i.customerName.split(' ')[0]}
                  </span>
                ))}
                {dayItems.length > 3 && <span className="adm-small">+{dayItems.length - 3}</span>}
                {blocked && <span className="adm-small">Bloqueado</span>}
              </Link>
            )
          })}
        </div>
      ) : (
        <TimeGrid
          days={days}
          items={items}
          blocks={blocks}
          startHour={startHour}
          endHour={endHour}
          today={today}
        />
      )}
      {view === 'dia' && items.length === 0 && blocks.length === 0 && (
        <p className="adm-sub">Nenhum atendimento neste dia.</p>
      )}
    </>
  )
}
