import { describe, expect, it } from 'vitest'

import {
  eventDurationLabel,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatMoney,
  formatMonth,
  todayInSaoPaulo,
} from '@/lib/format'

describe('pt-BR formatting', () => {
  it('money', () => {
    expect(formatMoney(22050).replace(/\s/g, ' ')).toBe('R$ 220,50')
  })
  it('dates are stable regardless of the machine time zone', () => {
    expect(formatDateLong('2026-12-15')).toBe('Terça-feira, 15 de dezembro de 2026')
    expect(formatDateShort('2026-12-15')).toBe('Ter, 15 de dezembro')
    expect(formatMonth('2026-12')).toBe('Dezembro de 2026')
  })
  it('today in São Paulo near midnight UTC', () => {
    expect(todayInSaoPaulo(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31')
  })
  it('durations and event labels', () => {
    expect(formatDuration(150)).toBe('2h30')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(45)).toBe('45 min')
    expect(eventDurationLabel('4_6h')).toBe('4 a 6 horas')
  })
})
