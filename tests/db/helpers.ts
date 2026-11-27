import { sql } from 'drizzle-orm'

import { generateKey, parseKeyRing } from '@/server/crypto/fields'
import { createDatabase } from '@/server/db/create'
import * as schema from '@/server/db/schema'
import type { CreateBookingInput } from '@/server/booking/create'
import { localToInstant } from '@/server/scheduling/time'

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres@localhost:5433/lsr_test'

export const keyRing = parseKeyRing(`v1:${generateKey()}`, 'v1')

/** A "now" safely before the test dates. */
export const NOW = localToInstant('2026-12-01', 9 * 60)
/** Terça-feira, open 08:00–19:00 by the default schedule. */
export const DAY = '2026-12-15'

export function openDb(max = 12) {
  return createDatabase(TEST_DATABASE_URL, max)
}

export type TestDb = ReturnType<typeof openDb>

export async function resetData(db: TestDb) {
  await db.execute(
    sql`truncate booking_events, bookings, customers, blocks, services restart identity cascade`,
  )
  await db.execute(sql`alter sequence booking_code_seq restart with 1`)
  await db.update(schema.scheduleSettings).set({
    bufferMin: 15,
    lunchEnabled: true,
    manualConfirmation: true,
    maxPendingPerContact: 2,
    bookingsPaused: false,
  })
  const [service] = await db
    .insert(schema.services)
    .values({
      slug: 'social',
      name: 'Maquiagem Social',
      category: 'Social',
      durationMin: 60,
      priceCents: 20000,
    })
    .returning()
  return service!
}

let counter = 0
export function bookingInput(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
  counter += 1
  return {
    idempotencyKey: `test-key-${Date.now()}-${counter}-xxxx`,
    serviceId: 1,
    date: DAY,
    time: '09:00',
    eventStart: '19:00',
    eventDuration: '4_6h',
    customer: {
      name: `Cliente Teste ${counter}`,
      phone: `(11) 9${String(10000000 + counter)}`,
      email: `cliente${counter}@exemplo.com`,
    },
    address: { line: 'Rua Exemplo, 100, Centro, São Paulo' },
    travel: { feeCents: 3000, toMin: 30, backMin: 30, distanceKm: 5 },
    ...overrides,
  }
}
