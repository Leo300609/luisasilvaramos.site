import { describe, expect, it } from 'vitest'

import {
  addDays,
  diffDays,
  instantToLocal,
  localToInstant,
  minutesToTime,
  timeToMinutes,
  weekdayOf,
} from '@/server/scheduling/time'

describe('time helpers (America/Sao_Paulo)', () => {
  it('converts local wall-clock to UTC (−03:00 today)', () => {
    expect(localToInstant('2026-12-12', 14 * 60).toISOString()).toBe('2026-12-12T17:00:00.000Z')
  })

  it('handles minutes beyond midnight', () => {
    expect(localToInstant('2026-12-31', 24 * 60 + 30).toISOString()).toBe(
      '2027-01-01T03:30:00.000Z',
    )
  })

  it('respects historical daylight saving time (summer 2018/2019 was −02:00)', () => {
    expect(localToInstant('2019-01-15', 10 * 60).toISOString()).toBe('2019-01-15T12:00:00.000Z')
    expect(localToInstant('2019-03-15', 10 * 60).toISOString()).toBe('2019-03-15T13:00:00.000Z')
  })

  it('converts back from an instant, including date rollover', () => {
    expect(instantToLocal(new Date('2027-01-01T02:30:00Z'))).toEqual({
      date: '2026-12-31',
      minutes: 23 * 60 + 30,
      weekday: 4,
    })
  })

  it('parses Postgres times with seconds', () => {
    expect(timeToMinutes('08:00:00')).toBe(480)
    expect(minutesToTime(570)).toBe('09:30')
  })

  it('rejects invalid dates and times', () => {
    expect(() => localToInstant('2026-02-30', 0)).toThrow()
    expect(() => timeToMinutes('24:00')).toThrow()
  })

  it('does calendar math across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(diffDays('2026-11-27', '2027-01-01')).toBe(35)
    expect(weekdayOf('2026-12-12')).toBe(6)
  })
})
