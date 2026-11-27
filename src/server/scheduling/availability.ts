/**
 * Availability algorithm (docs/fase-0-descoberta.md §5, revised by R3/R4).
 *
 * Pure and deterministic: everything it needs (rules, existing bookings, blocks,
 * travel time, "now") is passed in, so it is exhaustively unit-tested and the
 * exact same function runs when listing slots and when confirming a booking.
 *
 * Every appointment occupies [start − travel to, end + travel back + buffer):
 * the Luísa leaves, does the make-up, comes back and is free again.
 */
import {
  addDays,
  addMinutes,
  diffDays,
  localToInstant,
  minutesToTime,
  timeToMinutes,
  todayLocal,
  weekdayOf,
  type LocalDate,
} from './time'

export type Interval = { start: Date; end: Date }

export type ScheduleRules = {
  slotMode: 'grid' | 'auto'
  slotGrid: readonly string[]
  slotStepMin: number
  bufferMin: number
  minNoticeHours: number
  horizonDays: number
  lunchEnabled: boolean
  lunchStart: string
  lunchEnd: string
  readyBeforeEventMin: number
  recommendedMarginMin: number
  bookingsPaused: boolean
}

export type DayHours = { isOpen: boolean; opensAt: string; closesAt: string }

export type Travel = { toMin: number; backMin: number }

export type SlotFit =
  /** The latest start that still finishes with the recommended margin before the event. */
  | 'recommended'
  /** Fine: finishes before the recommended limit. */
  | 'ok'
  /** Allowed, but the make-up ends after the recommended time ("folga apertada"). */
  | 'tight'

export type Slot = { start: Date; end: Date; time: string; fit: SlotFit }

export type DayInput = {
  date: LocalDate
  now: Date
  durationMin: number
  rules: ScheduleRules
  /** Opening hours for this weekday (undefined = closed). */
  hours: DayHours | undefined
  blocks: readonly Interval[]
  /** Occupied ranges of active bookings (already include their own travel and buffer). */
  busy: readonly Interval[]
  travel: Travel
  /** Event start, local 'HH:MM' on the same date. Without it, no event rule applies. */
  eventStart?: string
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

/** Candidate start times (minutes since local midnight) for a day. */
function candidateStarts(rules: ScheduleRules, opens: number, closes: number, duration: number) {
  if (rules.slotMode === 'grid') {
    return [...new Set(rules.slotGrid.map(timeToMinutes))].sort((a, b) => a - b)
  }
  const out: number[] = []
  for (let m = opens; m + duration <= closes; m += rules.slotStepMin) out.push(m)
  return out
}

export type EventCheck =
  | { ok: true; fit: Exclude<SlotFit, 'recommended'> }
  | { ok: false; reason: 'ends-after-ready-time' }

/**
 * Event rule (Phase 0, R3): the client must be ready `readyBeforeEventMin` before
 * the event; we recommend the make-up ends `recommendedMarginMin` earlier still.
 * Event at 19:00 → ready by 18:30 (hard limit) → recommended to end by 17:30.
 */
export function checkEventFit(
  makeupEndMin: number,
  eventStartMin: number,
  rules: Pick<ScheduleRules, 'readyBeforeEventMin' | 'recommendedMarginMin'>,
): EventCheck {
  const readyBy = eventStartMin - rules.readyBeforeEventMin
  if (makeupEndMin > readyBy) return { ok: false, reason: 'ends-after-ready-time' }
  const recommendedEnd = readyBy - rules.recommendedMarginMin
  return { ok: true, fit: makeupEndMin > recommendedEnd ? 'tight' : 'ok' }
}

export function computeDaySlots(input: DayInput): Slot[] {
  const { date, now, durationMin, rules, hours, travel } = input
  if (rules.bookingsPaused || !hours?.isOpen) return []

  const today = todayLocal(now)
  const daysAhead = diffDays(today, date)
  if (daysAhead < 0 || daysAhead > rules.horizonDays) return []

  const opens = timeToMinutes(hours.opensAt)
  const closes = timeToMinutes(hours.closesAt)
  const earliest = addMinutes(now, rules.minNoticeHours * 60)
  const lunch: Interval | undefined = rules.lunchEnabled
    ? {
        start: localToInstant(date, timeToMinutes(rules.lunchStart)),
        end: localToInstant(date, timeToMinutes(rules.lunchEnd)),
      }
    : undefined
  const eventStartMin = input.eventStart === undefined ? undefined : timeToMinutes(input.eventStart)

  const slots: Slot[] = []
  for (const startMin of candidateStarts(rules, opens, closes, durationMin)) {
    const endMin = startMin + durationMin
    // Whole trip (leave home → come back) must fit the opening hours.
    if (startMin - travel.toMin < opens || endMin + travel.backMin > closes) continue

    const start = localToInstant(date, startMin)
    const end = localToInstant(date, endMin)
    if (start < earliest) continue

    const trip: Interval = {
      start: addMinutes(start, -travel.toMin),
      end: addMinutes(end, travel.backMin),
    }
    if (lunch && overlaps(trip, lunch)) continue
    if (input.blocks.some((block) => overlaps(trip, block))) continue

    const withBuffer: Interval = { start: trip.start, end: addMinutes(trip.end, rules.bufferMin) }
    if (input.busy.some((busy) => overlaps(withBuffer, busy))) continue

    let fit: SlotFit = 'ok'
    if (eventStartMin !== undefined) {
      const check = checkEventFit(endMin, eventStartMin, rules)
      if (!check.ok) continue
      fit = check.fit
    }
    slots.push({ start, end, time: minutesToTime(startMin), fit })
  }

  if (eventStartMin !== undefined) {
    // Highlight the latest slot that still respects the recommended margin.
    const best = slots.filter((s) => s.fit === 'ok').at(-1)
    if (best) best.fit = 'recommended'
  }
  return slots
}

/** Dates in [from, from + count) – used for month views and "próximos dias com vaga". */
export function dateRange(from: LocalDate, count: number): LocalDate[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i))
}

export { weekdayOf }
