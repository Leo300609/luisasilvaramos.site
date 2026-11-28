import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { confirmBooking } from '@/server/admin/bookings'
import { createAdminUser } from '@/server/auth/service'
import { createBooking } from '@/server/booking/create'
import * as schema from '@/server/db/schema'
import { MemoryMailer } from '@/server/email/mailer'
import { runHourly } from '@/server/jobs/hourly'
import { addMinutes, localToInstant } from '@/server/scheduling/time'

import { bookingInput, DAY, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())
const SECRET = 'test-auth-secret-0123456789abcdefghij'
let actorId = ''

beforeEach(async () => {
  await resetData(db)
  actorId = await createAdminUser(
    db,
    { email: 'l@exemplo.com', name: 'Luísa', password: 'café com pão e batom' },
    NOW,
  )
})

const run = (now: Date, mailer = new MemoryMailer()) =>
  runHourly(db, {
    mailer,
    keyRing,
    siteUrl: 'https://site.test',
    adminEmail: 'luisa@exemplo.com',
    now,
  }).then((report) => ({ report, mailer }))

describe('hourly job', () => {
  it('expires unconfirmed requests after the deadline and tells the client', async () => {
    const { id } = await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const { report: early } = await run(addMinutes(NOW, 60))
    expect(early.expired).toBe(0)
    const { report, mailer } = await run(addMinutes(NOW, 25 * 60))
    expect(report.expired).toBe(1)
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b).toMatchObject({ status: 'cancelado', cancelReason: 'expirado' })
    expect(mailer.sent.some((m) => m.subject.startsWith('Não foi possível confirmar'))).toBe(true)
  })

  it('sends the reminder once, from 18:00 the day before', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await confirmBooking(db, id, { now: NOW, actorId, secret: SECRET })
    const dayBefore = '2026-12-14'
    const { report: afternoon } = await run(localToInstant(dayBefore, 15 * 60))
    expect(afternoon.reminders).toBe(0)
    const first = await run(localToInstant(dayBefore, 18 * 60 + 5))
    const second = await run(localToInstant(dayBefore, 19 * 60 + 5))
    const reminders = [...first.mailer.sent, ...second.mailer.sent].filter((m) =>
      m.subject.startsWith('Lembrete'),
    )
    expect(reminders).toHaveLength(1)
    expect(reminders[0]!.text).toMatch(/\/a\/[A-Za-z0-9_-]{43}/)
  })

  it('sends the Luísa one daily summary with the day’s appointments', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await confirmBooking(db, id, { now: NOW, actorId, secret: SECRET })
    const morning = await run(localToInstant(DAY, 7 * 60 + 2))
    await run(localToInstant(DAY, 8 * 60 + 2))
    const summaries = morning.mailer.sent.filter((m) => m.subject.startsWith('Sua agenda de hoje'))
    expect(summaries).toHaveLength(1)
    expect(summaries[0]!.to).toBe('luisa@exemplo.com')
    expect(summaries[0]!.text).toContain('Rua Exemplo, 100')
    expect(summaries[0]!.text).toContain('sair às 08:30')
    const all = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.kind, 'daily_summary'))
    expect(all).toHaveLength(1)
  })

  it('erases allergy notes 30 days after the appointment', async () => {
    const { id } = await createBooking(
      db,
      bookingInput({ allergyNotes: 'Látex', allergyConsent: true }),
      { now: NOW, keyRing },
    )
    await run(localToInstant('2026-12-30', 12 * 60))
    let [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b!.allergyNotesEnc).not.toBeNull()
    const { report } = await run(localToInstant('2027-01-20', 12 * 60))
    ;[b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b!.allergyNotesEnc).toBeNull()
    expect(report.allergiesErased).toBe(1)
  })

  it('records each run and skips when another one is in progress', async () => {
    await db.insert(schema.jobRuns).values({ job: 'hourly', startedAt: NOW })
    const { report } = await run(addMinutes(NOW, 2))
    expect(report.skipped).toBe('locked')
    const { report: later } = await run(addMinutes(NOW, 15))
    expect(later.skipped).toBeUndefined()
    const runs = await db.select().from(schema.jobRuns)
    expect(runs.filter((r) => r.ok === true)).toHaveLength(2)
  })
})
