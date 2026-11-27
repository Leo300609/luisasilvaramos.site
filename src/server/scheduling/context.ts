/**
 * Loads everything the availability algorithm needs from the database.
 * All functions take the database (or a transaction) explicitly, so they run
 * inside the booking transaction and in tests against a real Postgres.
 */
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema'
import {
  computeDaySlots,
  type DayHours,
  type Interval,
  type ScheduleRules,
  type Slot,
  type Travel,
} from './availability'
import { addDays, localToInstant, weekdayOf, type LocalDate } from './time'
import type { TravelRules } from './travel'

export type Db = NodePgDatabase<typeof schema>

export type SchedulingConfig = {
  rules: ScheduleRules
  travel: TravelRules
  manualConfirmation: boolean
  pendingExpiryHours: number
  maxPendingPerContact: number
  cancelWindowHours: number
}

export async function loadConfig(db: Db): Promise<SchedulingConfig> {
  const [row] = await db
    .select()
    .from(schema.scheduleSettings)
    .where(eq(schema.scheduleSettings.id, 1))
  if (!row) throw new Error('schedule_settings row missing: run migrations')
  return {
    rules: {
      slotMode: row.slotMode,
      slotGrid: row.slotGrid,
      slotStepMin: row.slotStepMin,
      bufferMin: row.bufferMin,
      minNoticeHours: row.minNoticeHours,
      horizonDays: row.horizonDays,
      lunchEnabled: row.lunchEnabled,
      lunchStart: row.lunchStart,
      lunchEnd: row.lunchEnd,
      readyBeforeEventMin: row.readyBeforeEventMin,
      recommendedMarginMin: row.recommendedMarginMin,
      bookingsPaused: row.bookingsPaused,
    },
    travel: {
      minFeeCents: row.travelMinFeeCents,
      perKmCents: row.travelPerKmCents,
      maxRadiusKm: row.travelMaxRadiusKm,
      safetyFactor: Number(row.travelSafetyFactor),
    },
    manualConfirmation: row.manualConfirmation,
    pendingExpiryHours: row.pendingExpiryHours,
    maxPendingPerContact: row.maxPendingPerContact,
    cancelWindowHours: row.cancelWindowHours,
  }
}

export async function loadHours(db: Db): Promise<Map<number, DayHours>> {
  const rows = await db.select().from(schema.businessHours)
  return new Map(
    rows.map((r) => [r.weekday, { isOpen: r.isOpen, opensAt: r.opensAt, closesAt: r.closesAt }]),
  )
}

/** Occupied ranges of active bookings overlapping [from, to). */
export async function loadBusy(
  db: Db,
  from: Date,
  to: Date,
  excludeBookingId?: string,
): Promise<Interval[]> {
  const rows = await db
    .select({
      start: sql<Date>`lower(${schema.bookings.occupied})`.mapWith((v: string) => new Date(v)),
      end: sql<Date>`upper(${schema.bookings.occupied})`.mapWith((v: string) => new Date(v)),
    })
    .from(schema.bookings)
    .where(
      and(
        sql`${schema.bookings.status} in ('pendente', 'confirmado')`,
        sql`${schema.bookings.occupied} && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')`,
        excludeBookingId ? sql`${schema.bookings.id} <> ${excludeBookingId}` : undefined,
      ),
    )
  return rows
}

export async function loadBlocks(db: Db, from: Date, to: Date): Promise<Interval[]> {
  const rows = await db
    .select({ start: schema.blocks.startsAt, end: schema.blocks.endsAt })
    .from(schema.blocks)
    .where(and(lt(schema.blocks.startsAt, to), gt(schema.blocks.endsAt, from)))
  return rows
}

export type DayQuery = {
  date: LocalDate
  now: Date
  durationMin: number
  travel: Travel
  eventStart?: string
  excludeBookingId?: string
}

/** Slots for one day, reading rules and occupancy from the database. */
export async function getDaySlots(db: Db, query: DayQuery, config?: SchedulingConfig) {
  const cfg = config ?? (await loadConfig(db))
  const hours = await loadHours(db)
  // Window wide enough to catch neighbours' travel and buffers on both sides.
  const from = localToInstant(addDays(query.date, -1), 0)
  const to = localToInstant(addDays(query.date, 2), 0)
  const [busy, blocks] = await Promise.all([
    loadBusy(db, from, to, query.excludeBookingId),
    loadBlocks(db, from, to),
  ])
  return computeDaySlots({
    date: query.date,
    now: query.now,
    durationMin: query.durationMin,
    rules: cfg.rules,
    hours: hours.get(weekdayOf(query.date)),
    blocks,
    busy,
    travel: query.travel,
    ...(query.eventStart ? { eventStart: query.eventStart } : {}),
  })
}

/** "Que tal um destes dias próximos?": the next `count` dates with at least one slot. */
export async function findNextAvailableDays(
  db: Db,
  query: Omit<DayQuery, 'date' | 'eventStart'> & {
    after: LocalDate
    count: number
    maxDays?: number
  },
): Promise<Array<{ date: LocalDate; slots: Slot[] }>> {
  const cfg = await loadConfig(db)
  const hours = await loadHours(db)
  const maxDays = query.maxDays ?? 60
  const from = localToInstant(query.after, 0)
  const to = localToInstant(addDays(query.after, maxDays + 2), 0)
  const [busy, blocks] = await Promise.all([loadBusy(db, from, to), loadBlocks(db, from, to)])

  const found: Array<{ date: LocalDate; slots: Slot[] }> = []
  for (let i = 1; i <= maxDays && found.length < query.count; i++) {
    const date = addDays(query.after, i)
    const slots = computeDaySlots({
      date,
      now: query.now,
      durationMin: query.durationMin,
      rules: cfg.rules,
      hours: hours.get(weekdayOf(date)),
      blocks,
      busy,
      travel: query.travel,
    })
    if (slots.length) found.push({ date, slots })
  }
  return found
}

/** For the calendar: which days of a month have at least one slot. */
export async function getMonthAvailability(
  db: Db,
  query: { month: string; now: Date; durationMin: number; travel: Travel; eventStart?: string },
): Promise<Record<LocalDate, number>> {
  const cfg = await loadConfig(db)
  const hours = await loadHours(db)
  const first = `${query.month}-01`
  const [y, m] = query.month.split('-').map(Number)
  const days = new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate()
  const from = localToInstant(addDays(first, -1), 0)
  const to = localToInstant(addDays(first, days + 1), 0)
  const [busy, blocks] = await Promise.all([loadBusy(db, from, to), loadBlocks(db, from, to)])
  const out: Record<LocalDate, number> = {}
  for (let i = 0; i < days; i++) {
    const date = addDays(first, i)
    out[date] = computeDaySlots({
      date,
      now: query.now,
      durationMin: query.durationMin,
      rules: cfg.rules,
      hours: hours.get(weekdayOf(date)),
      blocks,
      busy,
      travel: query.travel,
      ...(query.eventStart ? { eventStart: query.eventStart } : {}),
    }).length
  }
  return out
}
