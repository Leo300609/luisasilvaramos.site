import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createBooking } from '@/server/booking/create'
import {
  cancelByClient,
  getClientBooking,
  rescheduleByClient,
  slotsForReschedule,
} from '@/server/booking/manage'
import { issueToken, resolveToken, revokeTokens } from '@/server/booking/tokens'
import * as schema from '@/server/db/schema'
import { addMinutes } from '@/server/scheduling/time'

import { bookingInput, DAY, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())
beforeEach(() => resetData(db))

describe('Minha agenda (client self-service)', () => {
  it('shows the booking with decrypted address and totals', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    const view = await getClientBooking(db, id, { keyRing, now: NOW })
    expect(view).toMatchObject({
      code: 'LSR-0001',
      time: '09:00',
      endTime: '10:00',
      date: DAY,
      totalCents: 23000,
      address: 'Rua Exemplo, 100, Centro, São Paulo',
      canChange: true,
    })
  })

  it('cancels inside the window and frees the slot', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await cancelByClient(db, id, { now: NOW })
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(row).toMatchObject({ status: 'cancelado', cancelReason: 'pedido_cliente' })
    await expect(
      createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing }),
    ).resolves.toBeTruthy()
  })

  it('refuses online changes inside the 48 h window', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    const late = new Date('2026-12-13T12:00:00Z') // < 48 h before 15/12 09:00
    await expect(cancelByClient(db, id, { now: late })).rejects.toMatchObject({
      code: 'outside-window',
    })
    const view = await getClientBooking(db, id, { keyRing, now: late })
    expect(view?.canChange).toBe(false)
  })

  it('reschedules: releases the old range, books the new one and logs it', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    const slots = await slotsForReschedule(db, id, DAY, { now: NOW })
    // Its own range is ignored, so 09:00 is offered again alongside later times.
    expect(slots.map((s) => s.time)).toContain('09:00')
    await rescheduleByClient(db, id, { date: DAY, time: '14:00' }, { now: NOW })
    const view = await getClientBooking(db, id, { keyRing, now: NOW })
    expect(view?.time).toBe('14:00')
    await expect(
      createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing }),
    ).resolves.toBeTruthy()
    const events = await db
      .select()
      .from(schema.bookingEvents)
      .where(eq(schema.bookingEvents.bookingId, id))
    expect(events.map((e) => e.type)).toEqual(['created', 'rescheduled'])
  })

  it('cannot reschedule onto someone else', async () => {
    const mine = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await createBooking(db, bookingInput({ time: '14:00' }), { now: NOW, keyRing })
    await expect(
      rescheduleByClient(db, mine.id, { date: DAY, time: '14:00' }, { now: NOW }),
    ).rejects.toMatchObject({ code: 'slot-taken' })
  })
})

describe('booking tokens', () => {
  it('resolve only while valid; stored hashed; revocable', async () => {
    const { id } = await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const { token } = await issueToken(db, id, addMinutes(NOW, 60))
    const rows = await db.select().from(schema.bookingTokens)
    expect(rows[0]?.tokenHash).not.toContain(token)
    expect(await resolveToken(db, token, NOW)).toBe(id)
    expect(await resolveToken(db, token, addMinutes(NOW, 61))).toBeNull()
    expect(await resolveToken(db, `${token.slice(0, -1)}A`, NOW)).toBeNull()
    expect(await resolveToken(db, 'LSR-0001', NOW)).toBeNull()
    await revokeTokens(db, id, NOW)
    expect(await resolveToken(db, token, NOW)).toBeNull()
  })
})
