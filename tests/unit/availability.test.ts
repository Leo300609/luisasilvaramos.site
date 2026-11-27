import { describe, expect, it } from 'vitest'

import {
  checkEventFit,
  computeDaySlots,
  type DayInput,
  type ScheduleRules,
} from '@/server/scheduling/availability'
import { localToInstant } from '@/server/scheduling/time'

const rules: ScheduleRules = {
  slotMode: 'auto',
  slotGrid: ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00'],
  slotStepMin: 30,
  bufferMin: 0,
  minNoticeHours: 24,
  horizonDays: 180,
  lunchEnabled: false,
  lunchStart: '12:30',
  lunchEnd: '13:30',
  readyBeforeEventMin: 30,
  recommendedMarginMin: 60,
  bookingsPaused: false,
}

const DAY = '2026-12-15' // terça-feira
const at = (time: string, date = DAY) => {
  const [h, m] = time.split(':').map(Number)
  return localToInstant(date, (h ?? 0) * 60 + (m ?? 0))
}

function input(overrides: Partial<DayInput> = {}): DayInput {
  return {
    date: DAY,
    now: at('09:00', '2026-12-01'),
    durationMin: 60,
    rules,
    hours: { isOpen: true, opensAt: '08:00', closesAt: '19:00' },
    blocks: [],
    busy: [],
    travel: { toMin: 0, backMin: 0 },
    ...overrides,
  }
}
const times = (i: DayInput) => computeDaySlots(i).map((s) => s.time)

describe('computeDaySlots: opening hours and modes', () => {
  it('auto mode: every 30 min, last one ends at closing time', () => {
    const t = times(input())
    expect(t[0]).toBe('08:00')
    expect(t.at(-1)).toBe('18:00')
    expect(t).toHaveLength(21)
  })

  it('grid mode: only the configured times that fit', () => {
    expect(times(input({ rules: { ...rules, slotMode: 'grid' } }))).toEqual([
      '08:00',
      '09:30',
      '11:00',
      '14:00',
      '15:30',
      '17:00',
    ])
  })

  it('long services drop grid times that would end after closing', () => {
    expect(times(input({ durationMin: 150, rules: { ...rules, slotMode: 'grid' } }))).toEqual([
      '08:00',
      '09:30',
      '11:00',
      '14:00',
      '15:30',
    ])
  })

  it('closed day, paused bookings and missing hours yield nothing', () => {
    expect(times(input({ hours: { isOpen: false, opensAt: '08:00', closesAt: '19:00' } }))).toEqual(
      [],
    )
    expect(times(input({ hours: undefined }))).toEqual([])
    expect(times(input({ rules: { ...rules, bookingsPaused: true } }))).toEqual([])
  })

  it('returns UTC instants and end = start + duration', () => {
    const [first] = computeDaySlots(input())
    expect(first?.start.toISOString()).toBe('2026-12-15T11:00:00.000Z')
    expect(first?.end.toISOString()).toBe('2026-12-15T12:00:00.000Z')
  })
})

describe('computeDaySlots: notice and horizon', () => {
  it('respects the minimum notice across midnight', () => {
    // now = 14/12 20:00 → with 24h notice, first slot on 15/12 is 20:00 (none left).
    expect(times(input({ now: at('20:00', '2026-12-14') }))).toEqual([])
    // now = 14/12 10:15 → first slot at 10:30 on 15/12.
    expect(times(input({ now: at('10:15', '2026-12-14') }))[0]).toBe('10:30')
  })

  it('12h notice allows same-evening bookings next morning', () => {
    const t = times(
      input({ now: at('22:00', '2026-12-14'), rules: { ...rules, minNoticeHours: 12 } }),
    )
    expect(t[0]).toBe('10:00')
  })

  it('never returns past days or days beyond the horizon', () => {
    expect(times(input({ now: at('09:00', '2026-12-16') }))).toEqual([])
    expect(
      times(input({ now: at('09:00', '2026-06-01'), rules: { ...rules, horizonDays: 180 } })),
    ).toEqual([])
  })
})

describe('computeDaySlots: lunch, blocks, existing bookings, buffer', () => {
  it('lunch removes slots overlapping 12:30–13:30', () => {
    const t = times(input({ rules: { ...rules, lunchEnabled: true } }))
    expect(t).toContain('11:30') // 11:30–12:30 touches lunch start: allowed
    expect(t).not.toContain('12:00')
    expect(t).not.toContain('13:00')
    expect(t).toContain('13:30')
  })

  it('partial and full-day blocks', () => {
    const partial = times(input({ blocks: [{ start: at('14:00'), end: at('17:00') }] }))
    expect(partial).toContain('13:00')
    expect(partial).not.toContain('13:30')
    expect(partial).not.toContain('16:30')
    expect(partial).toContain('17:00')
    expect(
      times(input({ blocks: [{ start: at('00:00'), end: at('00:00', '2026-12-16') }] })),
    ).toEqual([])
  })

  it('existing bookings block their own range; back-to-back is allowed without buffer', () => {
    const t = times(input({ busy: [{ start: at('10:00'), end: at('11:00') }] }))
    expect(t).toContain('09:00')
    expect(t).not.toContain('09:30')
    expect(t).not.toContain('10:30')
    expect(t).toContain('11:00')
  })

  it('buffer is kept after the new appointment too', () => {
    const t = times(
      input({
        rules: { ...rules, bufferMin: 30 },
        busy: [{ start: at('10:00'), end: at('11:00') }],
      }),
    )
    expect(t).toContain('08:30') // ends 09:30 + 30 buffer = 10:00 ✓
    expect(t).not.toContain('09:00') // ends 10:00 + buffer overlaps
  })
})

describe('computeDaySlots: travel (leave, work, come back)', () => {
  const travel = { toMin: 45, backMin: 45 }

  it('the whole trip must fit the opening hours', () => {
    const t = times(input({ travel }))
    expect(t[0]).toBe('09:00') // leaves 08:15
    expect(t.at(-1)).toBe('17:00') // back at 18:45
  })

  it('travel time cannot overlap other bookings, blocks or lunch', () => {
    const busy = times(input({ travel, busy: [{ start: at('11:00'), end: at('12:00') }] }))
    expect(busy).not.toContain('12:30') // would leave at 11:45
    expect(busy).toContain('13:00') // leaves 12:15, after the other booking ends
    const lunch = times(input({ travel, rules: { ...rules, lunchEnabled: true } }))
    expect(lunch).not.toContain('11:00') // back at 12:45, inside lunch
    expect(lunch).toContain('14:30') // leaves 13:45
  })
})

describe('event rule (ready 30 min before, recommended 60 min earlier)', () => {
  it('checkEventFit matches the agreed example (event 19:00)', () => {
    const r = { readyBeforeEventMin: 30, recommendedMarginMin: 60 }
    expect(checkEventFit(17 * 60 + 30, 19 * 60, r)).toEqual({ ok: true, fit: 'ok' })
    expect(checkEventFit(18 * 60, 19 * 60, r)).toEqual({ ok: true, fit: 'tight' })
    expect(checkEventFit(18 * 60 + 30, 19 * 60, r)).toEqual({ ok: true, fit: 'tight' })
    expect(checkEventFit(18 * 60 + 31, 19 * 60, r)).toEqual({
      ok: false,
      reason: 'ends-after-ready-time',
    })
  })

  it('marks the latest comfortable slot as recommended and later ones as tight', () => {
    const slots = computeDaySlots(input({ durationMin: 150, eventStart: '19:00' }))
    const byTime = Object.fromEntries(slots.map((s) => [s.time, s.fit]))
    expect(byTime['15:00']).toBe('recommended') // ends 17:30
    expect(byTime['15:30']).toBe('tight') // ends 18:00
    expect(byTime['16:00']).toBe('tight') // ends 18:30 = ready time
    expect(byTime['16:30']).toBeUndefined() // ends 19:00: too late
    expect(byTime['14:30']).toBe('ok')
    expect(slots.filter((s) => s.fit === 'recommended')).toHaveLength(1)
  })

  it('an early event leaves only the slots that end in time', () => {
    const t = times(input({ eventStart: '10:00' }))
    expect(t).toEqual(['08:00', '08:30']) // ends 09:00 / 09:30 = ready time
  })
})
