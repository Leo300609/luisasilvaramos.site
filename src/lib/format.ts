/** pt-BR formatting helpers (safe on server and client). Dates are 'YYYY-MM-DD' local. */

const TZ = 'America/Sao_Paulo'

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

/** Noon UTC keeps the calendar date stable in any time zone. */
const asDate = (date: string) => new Date(`${date}T12:00:00Z`)

export function formatDateLong(date: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(asDate(date))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatDateShort(date: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
    .format(asDate(date))
    .replace('.', '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatMonth(month: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export const EVENT_DURATIONS = [
  { value: 'ate_2h', label: 'Até 2 horas' },
  { value: '2_3h', label: '2 a 3 horas' },
  { value: '3_4h', label: '3 a 4 horas' },
  { value: '4_6h', label: '4 a 6 horas' },
  { value: 'mais_6h', label: 'Mais de 6 horas' },
  { value: 'dia_inteiro', label: 'Dia inteiro' },
] as const

export type EventDurationValue = (typeof EVENT_DURATIONS)[number]['value']

export function eventDurationLabel(value: string | null | undefined): string {
  return EVENT_DURATIONS.find((d) => d.value === value)?.label ?? ''
}
