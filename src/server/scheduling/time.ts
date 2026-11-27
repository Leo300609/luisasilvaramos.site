import { TZDate } from '@date-fns/tz'

/**
 * Wall-clock helpers for America/Sao_Paulo. The database stores UTC instants;
 * every business rule (opening hours, lunch, event time) is expressed in local
 * time and converted here. Brazil has had no DST since 2019, but historical
 * dates still follow the tz database, so we never assume a fixed −03:00 offset.
 */
export const TIME_ZONE = 'America/Sao_Paulo'

/** 'YYYY-MM-DD' local calendar date. */
export type LocalDate = string

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(date)
  if (!match) throw new Error(`Invalid local date: ${date}`)
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Invalid local date: ${date}`)
  }
  return { year, month, day }
}

/** 'HH:MM' (or 'HH:MM:SS' as Postgres returns) → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const match = TIME_RE.exec(time)
  if (!match) throw new Error(`Invalid time: ${time}`)
  return Number(match[1]) * 60 + Number(match[2])
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** The UTC instant of a local date + minutes since local midnight (may exceed 24h). */
export function localToInstant(date: LocalDate, minutes: number): Date {
  const { year, month, day } = parseLocalDate(date)
  const local = new TZDate(year, month - 1, day, 0, 0, 0, TIME_ZONE)
  local.setMinutes(minutes)
  return new Date(local.getTime())
}

export function instantToLocal(instant: Date): {
  date: LocalDate
  minutes: number
  weekday: number
} {
  const local = new TZDate(instant.getTime(), TIME_ZONE)
  const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
    local.getDate(),
  ).padStart(2, '0')}`
  return { date, minutes: local.getHours() * 60 + local.getMinutes(), weekday: local.getDay() }
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from)
  const b = parseLocalDate(to)
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  )
}

export function todayLocal(now: Date): LocalDate {
  return instantToLocal(now).date
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000)
}
