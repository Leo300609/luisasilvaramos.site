/**
 * Development seed: the four services from the design (values are suggestions,
 * TODO(Leo): confirm with the Luísa) and, with --demo, example bookings.
 *   npm run db:seed            → services only (safe to run in production)
 *   npm run db:seed -- --demo  → also fake bookings (NEVER in production)
 */
import { sql } from 'drizzle-orm'

import { createBooking } from '../src/server/booking/create'
import { generateKey, parseKeyRing } from '../src/server/crypto/fields'
import { createDatabase } from '../src/server/db/create'
import * as schema from '../src/server/db/schema'
import { addDays, todayLocal, weekdayOf } from '../src/server/scheduling/time'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Set DATABASE_URL')
const demo = process.argv.includes('--demo')
if (demo && process.env.APP_ENV === 'production')
  throw new Error('Refusing demo data in production')

const db = createDatabase(url, 2)

const SERVICES = [
  {
    slug: 'social',
    name: 'Maquiagem Social',
    category: 'Social',
    durationMin: 60,
    priceCents: 20000,
    sortOrder: 1,
    description: 'Aniversários, jantares e encontros. Elegante e confortável.',
  },
  {
    slug: 'noiva',
    name: 'Maquiagem para Noivas',
    category: 'Noiva',
    durationMin: 150,
    priceCents: 75000,
    sortOrder: 2,
    description: 'À prova de emoção, do altar à pista.',
  },
  {
    slug: 'formatura',
    name: 'Maquiagem para Formaturas',
    category: 'Formatura',
    durationMin: 90,
    priceCents: 25000,
    sortOrder: 3,
    description: 'Marcante e fotogênica para celebrar a sua conquista.',
  },
  {
    slug: 'eventos',
    name: 'Maquiagem para Eventos e Festas',
    category: 'Eventos e Festas',
    durationMin: 75,
    priceCents: 22000,
    sortOrder: 4,
    description: 'Casamentos, festas e ocasiões especiais.',
  },
]

try {
  for (const service of SERVICES) {
    await db
      .insert(schema.services)
      .values(service)
      .onConflictDoNothing({ target: schema.services.slug })
  }
  console.log(`Services ready (${SERVICES.length}).`)

  if (demo) {
    const keyRing = parseKeyRing(
      process.env.ENC_KEYS ?? `v1:${generateKey()}`,
      process.env.ENC_ACTIVE_KEY ?? 'v1',
    )
    const now = new Date()
    const services = await db.select().from(schema.services)
    const bySlug = Object.fromEntries(services.map((s) => [s.slug, s.id]))
    const base = todayLocal(now)
    // Next open day (Tue–Sat by default) at least `offset` days ahead.
    const openDay = (offset: number) => {
      let d = addDays(base, offset)
      while ([0, 1].includes(weekdayOf(d))) d = addDays(d, 1)
      return d
    }
    const d1 = openDay(3)
    const d2 = openDay(diffFrom(d1) + 1)
    function diffFrom(d: string) {
      let i = 0
      while (addDays(base, i) !== d) i += 1
      return i
    }
    const plan = [
      { date: d1, time: '09:00', slug: 'social', event: '19:00' },
      { date: d1, time: '14:00', slug: 'formatura', event: '20:00' },
      { date: d2, time: '09:00', slug: 'noiva', event: '17:00' },
      { date: d2, time: '15:00', slug: 'eventos', event: '19:30' },
    ]
    let n = 0
    for (const item of plan) {
      n += 1
      try {
        const r = await createBooking(
          db,
          {
            idempotencyKey: `demo-seed-${item.date}-${item.time}-${item.slug}`,
            serviceId: bySlug[item.slug]!,
            date: item.date,
            time: item.time,
            eventStart: item.event,
            eventDuration: '4_6h',
            customer: {
              name: `Cliente Exemplo ${n}`,
              phone: `1190000000${n}`,
              email: `exemplo${n}@exemplo.com`,
            },
            address: { line: 'Endereço fictício, 100, São Paulo' },
            travel: { feeCents: 3000, toMin: 30, backMin: 30, distanceKm: 5 },
          },
          { now, keyRing },
        )
        console.log(`  ${r.code} ${item.slug} ${item.date} ${item.time}`)
      } catch (error) {
        console.log(`  skipped ${item.slug} ${item.time}: ${(error as Error).message}`)
      }
    }
  }
  const { rows } = await db.execute(sql`select count(*)::int as n from bookings`)
  console.log('Bookings:', rows[0])
} finally {
  await db.$pool.end()
}
