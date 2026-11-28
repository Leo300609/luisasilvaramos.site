/** Read models for the panel's dashboard and agenda views (local São Paulo time). */
import { and, count, eq, gte, lt, sql } from 'drizzle-orm'

import * as schema from '../db/schema'
import { formatBookingCode } from '../booking/create'
import type { Db } from '../scheduling/context'
import {
  addDays,
  instantToLocal,
  localToInstant,
  minutesToTime,
  todayLocal,
  weekdayOf,
} from '../scheduling/time'
import type { BookingStatus } from './bookings'

export type AgendaItem = {
  id: string
  code: string
  status: BookingStatus
  customerName: string
  serviceName: string
  date: string
  /** Minutes since local midnight. */
  startMin: number
  endMin: number
  /** Occupied range incl. travel and buffer, minutes since local midnight of `date`. */
  busyStartMin: number
  busyEndMin: number
  eventStart: string | null
  totalCents: number
}

export type AgendaBlock = {
  id: string
  date: string
  startMin: number
  endMin: number
  allDay: boolean
  reason: string
}

const minutesOn = (date: string, instant: Date) =>
  Math.round((instant.getTime() - localToInstant(date, 0).getTime()) / 60_000)

/** Bookings and blocks between two local dates (inclusive), one entry per day for blocks. */
export async function loadAgenda(
  db: Db,
  from: string,
  to: string,
  opts: { includeCancelled?: boolean } = {},
): Promise<{ items: AgendaItem[]; blocks: AgendaBlock[] }> {
  const start = localToInstant(from, 0)
  const end = localToInstant(addDays(to, 1), 0)
  const [rows, blockRows] = await Promise.all([
    db
      .select({ b: schema.bookings, name: schema.customers.name })
      .from(schema.bookings)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
      .where(
        and(
          gte(schema.bookings.startsAt, start),
          lt(schema.bookings.startsAt, end),
          opts.includeCancelled ? undefined : sql`${schema.bookings.status} <> 'cancelado'`,
        ),
      )
      .orderBy(schema.bookings.startsAt),
    db
      .select()
      .from(schema.blocks)
      .where(and(lt(schema.blocks.startsAt, end), sql`${schema.blocks.endsAt} > ${start}`))
      .orderBy(schema.blocks.startsAt),
  ])

  const items = rows.map(({ b, name }) => {
    const date = instantToLocal(b.startsAt).date
    const startMin = minutesOn(date, b.startsAt)
    const endMin = minutesOn(date, b.endsAt)
    return {
      id: b.id,
      code: formatBookingCode(b.codeSeq),
      status: b.status,
      customerName: name,
      serviceName: b.serviceName,
      date,
      startMin,
      endMin,
      busyStartMin: startMin - b.travelToMin,
      busyEndMin: endMin + b.travelBackMin + b.bufferMin,
      eventStart: b.eventStartsAt ? minutesToTime(instantToLocal(b.eventStartsAt).minutes) : null,
      totalCents: b.priceCents + b.travelFeeCents,
    }
  })

  const blocks: AgendaBlock[] = []
  for (const bl of blockRows) {
    // Split multi-day blocks per local day, clipped to the requested range.
    let day = instantToLocal(bl.startsAt).date
    if (day < from) day = from
    while (day <= to) {
      const dayStart = localToInstant(day, 0)
      const dayEnd = localToInstant(addDays(day, 1), 0)
      if (bl.startsAt >= dayEnd) break
      if (bl.endsAt <= dayStart) break
      blocks.push({
        id: bl.id,
        date: day,
        startMin: Math.max(0, minutesOn(day, bl.startsAt)),
        endMin: Math.min(24 * 60, minutesOn(day, bl.endsAt)),
        allDay: bl.allDay,
        reason: bl.reason,
      })
      day = addDays(day, 1)
    }
  }
  return { items, blocks }
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const wd = weekdayOf(date) // 0 = Sunday
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export function monthGrid(month: string): { from: string; to: string; days: string[] } {
  const first = `${month}-01`
  const from = weekStart(first)
  const days: string[] = []
  for (let i = 0; i < 42; i++) days.push(addDays(from, i))
  return { from, to: days[days.length - 1]!, days }
}

export type DashboardStats = {
  today: AgendaItem[]
  weekCount: number
  pendingCount: number
  monthForecastCents: number
  nextPending: AgendaItem[]
}

export async function dashboardStats(db: Db, now: Date): Promise<DashboardStats> {
  const today = todayLocal(now)
  const ws = weekStart(today)
  const month = today.slice(0, 7)
  const monthStart = localToInstant(`${month}-01`, 0)
  const [y, m] = month.split('-').map(Number) as [number, number]
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`

  const [day, week, [pending], [forecast], pendingSoon] = await Promise.all([
    loadAgenda(db, today, today),
    loadAgenda(db, ws, addDays(ws, 6)),
    db.select({ n: count() }).from(schema.bookings).where(eq(schema.bookings.status, 'pendente')),
    db
      .select({
        cents: sql<number>`coalesce(sum(${schema.bookings.priceCents} + ${schema.bookings.travelFeeCents}), 0)::int`,
      })
      .from(schema.bookings)
      .where(
        and(
          sql`${schema.bookings.status} in ('confirmado', 'concluido')`,
          gte(schema.bookings.startsAt, monthStart),
          lt(schema.bookings.startsAt, localToInstant(nextMonth, 0)),
        ),
      ),
    loadAgenda(db, today, addDays(today, 90)),
  ])
  return {
    today: day.items,
    weekCount: week.items.length,
    pendingCount: pending?.n ?? 0,
    monthForecastCents: forecast?.cents ?? 0,
    nextPending: pendingSoon.items.filter((i) => i.status === 'pendente').slice(0, 5),
  }
}
