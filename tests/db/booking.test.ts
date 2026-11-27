import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createBooking } from '@/server/booking/create'
import { BookingError } from '@/server/booking/errors'
import { decryptField } from '@/server/crypto/fields'
import * as schema from '@/server/db/schema'
import { findNextAvailableDays, getDaySlots } from '@/server/scheduling/context'
import { localToInstant } from '@/server/scheduling/time'

import { bookingInput, DAY, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())
beforeEach(() => resetData(db))

const deps = { now: NOW, keyRing }

describe('createBooking', () => {
  it('creates a pending booking with code, snapshot, travel and encrypted address', async () => {
    const result = await createBooking(db, bookingInput(), deps)
    expect(result).toMatchObject({ code: 'LSR-0001', status: 'pendente', replayed: false })

    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, result.id))
    expect(row?.priceCents).toBe(20000)
    expect(row?.startsAt.toISOString()).toBe('2026-12-15T12:00:00.000Z')
    expect(row?.endsAt.toISOString()).toBe('2026-12-15T13:00:00.000Z')
    // Trigger computed [start − 30, end + 30 + 15 buffer)
    expect(row?.occupied).toBe('["2026-12-15 11:30:00+00","2026-12-15 13:45:00+00")')
    expect(row?.addressEnc).not.toContain('Rua')
    expect(decryptField(row!.addressEnc, keyRing, 'bookings.address')).toBe(
      'Rua Exemplo, 100, Centro, São Paulo',
    )
    expect(row?.expiresAt?.toISOString()).toBe(
      new Date(NOW.getTime() + 24 * 3600_000).toISOString(),
    )

    const events = await db.select().from(schema.bookingEvents)
    expect(events).toHaveLength(1)
  })

  it('is idempotent: retrying with the same key returns the same booking', async () => {
    const input = bookingInput()
    const first = await createBooking(db, input, deps)
    const second = await createBooking(db, input, deps)
    expect(second).toEqual({ ...first, replayed: true })
    const [{ count }] = (await db.execute(sql`select count(*)::int as count from bookings`))
      .rows as [{ count: number }]
    expect(count).toBe(1)
  })

  it('auto-confirms when manual confirmation is off', async () => {
    await db.update(schema.scheduleSettings).set({ manualConfirmation: false })
    expect((await createBooking(db, bookingInput(), deps)).status).toBe('confirmado')
  })

  it('removes the slot (and its travel/buffer neighbours) from availability', async () => {
    await createBooking(db, bookingInput({ time: '10:00' }), deps)
    const slots = await getDaySlots(db, {
      date: DAY,
      now: NOW,
      durationMin: 60,
      travel: { toMin: 30, backMin: 30 },
    })
    const times = slots.map((s) => s.time)
    // Booked 10:00–11:00 occupies 09:30–11:45 (travel 30/30 + buffer 15). Before it, the
    // earliest trip would have to leave before opening; after it, lunch (12:30–13:30) and
    // the 30 min trip push the next start to 14:00.
    expect(times[0]).toBe('14:00')
    expect(times).not.toContain('10:00')
  })

  it('refuses a slot that is not available on the server, whatever the browser says', async () => {
    await expect(createBooking(db, bookingInput({ time: '12:30' }), deps)).rejects.toMatchObject({
      code: 'slot-taken', // lunch 12:30–13:30
    })
    await expect(createBooking(db, bookingInput({ time: '18:30' }), deps)).rejects.toBeInstanceOf(
      BookingError,
    )
  })

  it('enforces the event rule (ready 30 min before the event)', async () => {
    await expect(
      createBooking(db, bookingInput({ time: '17:00', eventStart: '18:00' }), deps),
    ).rejects.toMatchObject({ code: 'slot-taken' })
    await expect(
      createBooking(db, bookingInput({ time: '16:30', eventStart: '18:00' }), deps),
    ).resolves.toMatchObject({
      status: 'pendente',
    })
  })

  it('limits pending bookings per contact (mass-booking protection)', async () => {
    const customer = { name: 'Maria Souza', phone: '11912345678', email: 'maria@exemplo.com' }
    await createBooking(db, bookingInput({ customer, time: '08:30' }), deps)
    await createBooking(db, bookingInput({ customer, time: '14:00' }), deps)
    await expect(
      createBooking(
        db,
        bookingInput({ customer: { ...customer, email: 'outra@exemplo.com' }, time: '16:30' }),
        deps,
      ),
    ).rejects.toMatchObject({ code: 'too-many-pending' })
  })

  it('requires explicit consent to store allergy notes', async () => {
    await expect(
      createBooking(db, bookingInput({ allergyNotes: 'Alergia a látex' }), deps),
    ).rejects.toMatchObject({ code: 'consent-required' })
    await expect(
      createBooking(
        db,
        bookingInput({ allergyNotes: 'Alergia a látex', allergyConsent: true }),
        deps,
      ),
    ).resolves.toBeTruthy()
  })

  it('suggests the next days with free slots when a day is full', async () => {
    await db.insert(schema.blocks).values({
      startsAt: localToInstant(DAY, 0),
      endsAt: localToInstant('2026-12-16', 0),
      allDay: true,
      reason: 'Folga',
    })
    const next = await findNextAvailableDays(db, {
      after: '2026-12-14',
      count: 3,
      now: NOW,
      durationMin: 60,
      travel: { toMin: 30, backMin: 30 },
    })
    // 15/12 blocked; 16, 17, 18 are Wed–Fri.
    expect(next.map((d) => d.date)).toEqual(['2026-12-16', '2026-12-17', '2026-12-18'])
  })
})

describe('database guarantees (even if the application had a bug)', () => {
  it('EXCLUDE constraint rejects overlapping active bookings written directly', async () => {
    const first = await createBooking(db, bookingInput({ time: '09:00' }), deps)
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, first.id))
    const omit = ['id', 'codeSeq', 'occupied', 'idempotencyKey', 'createdAt', 'updatedAt']
    const copy = Object.fromEntries(
      Object.entries(row!).filter(([key]) => !omit.includes(key)),
    ) as typeof schema.bookings.$inferInsert
    await expect(
      db.insert(schema.bookings).values({
        ...copy,
        startsAt: new Date(row!.startsAt.getTime() + 30 * 60_000),
        endsAt: new Date(row!.endsAt.getTime() + 30 * 60_000),
      }),
    ).rejects.toMatchObject({ cause: { code: '23P01' } })
  })

  it('cancelled bookings free the slot', async () => {
    const first = await createBooking(db, bookingInput({ time: '09:00' }), deps)
    await db
      .update(schema.bookings)
      .set({ status: 'cancelado', cancelReason: 'pedido_cliente', cancelledAt: NOW })
      .where(eq(schema.bookings.id, first.id))
    await expect(createBooking(db, bookingInput({ time: '09:00' }), deps)).resolves.toMatchObject({
      code: 'LSR-0002',
    })
  })

  it('booking history is append-only', async () => {
    await createBooking(db, bookingInput(), deps)
    await expect(db.execute(sql`delete from booking_events`)).rejects.toMatchObject({
      cause: { message: 'booking_events is append-only' },
    })
  })

  it('a cancelled booking must have a reason', async () => {
    const first = await createBooking(db, bookingInput(), deps)
    await expect(
      db
        .update(schema.bookings)
        .set({ status: 'cancelado' })
        .where(eq(schema.bookings.id, first.id)),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
  })
})
