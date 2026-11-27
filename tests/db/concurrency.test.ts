import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createBooking } from '@/server/booking/create'

import { bookingInput, keyRing, NOW, openDb, resetData } from './helpers'

// Each client gets its own pool: truly parallel connections, like separate serverless functions.
const clients = Array.from({ length: 10 }, () => openDb(1))
const admin = openDb(2)
afterAll(async () => {
  await Promise.all([...clients, admin].map((c) => c.$pool.end()))
})
beforeEach(() => resetData(admin))

describe('concurrency: two clients can never book the same time', () => {
  it('10 simultaneous requests for 14:00 → exactly 1 booking, 9 "slot-taken"', async () => {
    const results = await Promise.allSettled(
      clients.map((db) =>
        createBooking(db, bookingInput({ time: '14:00' }), { now: NOW, keyRing }),
      ),
    )
    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(9)
    for (const f of failed) expect(f.reason).toMatchObject({ code: 'slot-taken' })

    const { rows } = await admin.execute(sql`select count(*)::int as n from bookings`)
    expect(rows[0]).toEqual({ n: 1 })
  })

  it('overlapping (not identical) times are also serialized: 14:00 vs 14:30', async () => {
    const results = await Promise.allSettled(
      clients.map((db, i) =>
        createBooking(db, bookingInput({ time: i % 2 ? '14:00' : '14:30' }), { now: NOW, keyRing }),
      ),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })

  it('double click (same idempotency key, in parallel) creates one booking', async () => {
    const input = bookingInput({ time: '15:00' })
    const results = await Promise.all(
      clients.slice(0, 5).map((db) => createBooking(db, input, { now: NOW, keyRing })),
    )
    expect(new Set(results.map((r) => r.id)).size).toBe(1)
    expect(results.filter((r) => !r.replayed)).toHaveLength(1)
  })
})
