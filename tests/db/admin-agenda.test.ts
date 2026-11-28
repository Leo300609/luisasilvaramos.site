import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { dashboardStats, loadAgenda, monthGrid, weekStart } from '@/server/admin/agenda'
import {
  cancelFromPanel,
  closeFromPanel,
  createBlock,
  createBookingFromPanel,
  deleteBlock,
  readInternalNotes,
  rescheduleFromPanel,
  saveInternalNotes,
  type AdminBookingInput,
} from '@/server/admin/manage'
import { createAdminUser } from '@/server/auth/service'
import { createBooking } from '@/server/booking/create'
import * as schema from '@/server/db/schema'
import { MemoryMailer } from '@/server/email/mailer'
import { deliverDueEmails } from '@/server/email/outbox'
import { addMinutes } from '@/server/scheduling/time'

import { bookingInput, DAY, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())

const SECRET = 'test-auth-secret-0123456789abcdefghij'
let deps: { now: Date; actorId: string; secret: string; keyRing: typeof keyRing }

beforeEach(async () => {
  await resetData(db)
  const actorId = await createAdminUser(
    db,
    { email: 'luisa@exemplo.com', name: 'Luísa', password: 'café com pão e batom' },
    NOW,
  )
  deps = { now: NOW, actorId, secret: SECRET, keyRing }
})

const panelInput = (over: Partial<AdminBookingInput> = {}): AdminBookingInput => ({
  serviceId: 1,
  date: DAY,
  time: '22:00', // outside opening hours: allowed in the panel
  customer: { name: 'Cliente do Balcão', phone: '(11) 98888-7777', email: '' },
  address: 'Rua do Teste, 10',
  travel: { feeCents: 0, toMin: 0, backMin: 0, distanceKm: null },
  ...over,
})

const mailsFor = async (now = NOW) => {
  const mailer = new MemoryMailer()
  await deliverDueEmails(db, {
    mailer,
    keyRing,
    siteUrl: 'https://site.test',
    adminEmail: null,
    now,
  })
  return mailer.sent
}

describe('panel: bookings', () => {
  it('books outside opening hours, confirmed, without e-mail when there is none', async () => {
    const { id, code } = await createBookingFromPanel(db, panelInput(), deps)
    expect(code).toBe('LSR-0001')
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b).toMatchObject({ status: 'confirmado', source: 'admin' })
    expect(await mailsFor()).toHaveLength(0)
  })

  it('never overlaps another appointment or a block', async () => {
    await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await expect(
      createBookingFromPanel(db, panelInput({ time: '09:30' }), deps),
    ).rejects.toMatchObject({ code: 'slot-taken' })
    await createBlock(
      db,
      { date: DAY, allDay: false, start: '15:00', end: '17:00', reason: 'Dentista' },
      deps,
    )
    await expect(
      createBookingFromPanel(db, panelInput({ time: '16:00' }), deps),
    ).rejects.toMatchObject({ code: 'slot-taken' })
  })

  it('reschedules, cancels with notice and closes after the appointment', async () => {
    const a = await createBookingFromPanel(
      db,
      panelInput({
        time: '09:00',
        customer: { name: 'Ana', phone: '11977776666', email: 'ana@exemplo.com' },
      }),
      deps,
    )
    await rescheduleFromPanel(db, a.id, { date: DAY, time: '14:00', notify: true }, deps)
    const [moved] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, a.id))
    expect(moved!.startsAt.toISOString()).toBe('2026-12-15T17:00:00.000Z')
    const first = (await mailsFor()).map((m) => m.subject)
    expect(first.some((s) => s.startsWith('Agendamento confirmado'))).toBe(true)
    expect(first.some((s) => s.startsWith('Agendamento remarcado'))).toBe(true)

    await expect(closeFromPanel(db, a.id, 'concluido', deps)).rejects.toThrow(/depois do horário/)
    const after = { ...deps, now: addMinutes(moved!.startsAt, 90) }
    await closeFromPanel(db, a.id, 'concluido', after)
    const [done] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, a.id))
    expect(done!.status).toBe('concluido')

    const b = await createBookingFromPanel(
      db,
      panelInput({
        time: '18:00',
        customer: { name: 'Bia', phone: '11966665555', email: 'bia@exemplo.com' },
      }),
      deps,
    )
    await cancelFromPanel(db, b.id, { reason: 'imprevisto_maquiadora', notify: true }, deps)
    const subjects = (await mailsFor()).map((m) => m.subject)
    expect(subjects.some((s) => s.startsWith('Agendamento cancelado'))).toBe(true)
  })

  it('keeps internal notes encrypted', async () => {
    const { id } = await createBookingFromPanel(db, panelInput(), deps)
    await saveInternalNotes(db, id, 'Prefere pele matte', deps)
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b!.internalNotesEnc).not.toContain('matte')
    expect(readInternalNotes(b!.internalNotesEnc, keyRing)).toBe('Prefere pele matte')
  })
})

describe('panel: blocks', () => {
  it('refuses a block over an active appointment and lists the conflict', async () => {
    await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    const r = await createBlock(db, { date: DAY, allDay: true, reason: 'Folga' }, deps)
    expect(r).toMatchObject({ ok: false, conflicts: [{ code: 'LSR-0001' }] })
  })

  it('blocks multiple days and frees them again', async () => {
    const r = await createBlock(
      db,
      { date: '2026-12-24', endDate: '2026-12-26', allDay: true, reason: 'Natal' },
      deps,
    )
    expect(r.ok).toBe(true)
    const { blocks } = await loadAgenda(db, '2026-12-23', '2026-12-27')
    expect(blocks.map((b) => b.date)).toEqual(['2026-12-24', '2026-12-25', '2026-12-26'])
    if (r.ok) await deleteBlock(db, r.id, deps)
    expect((await loadAgenda(db, '2026-12-23', '2026-12-27')).blocks).toHaveLength(0)
  })
})

describe('agenda read models', () => {
  it('places items with their travel range and computes the dashboard', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    const { items } = await loadAgenda(db, DAY, DAY)
    expect(items[0]).toMatchObject({
      id,
      startMin: 540,
      endMin: 600,
      busyStartMin: 510,
      busyEndMin: 645,
    })
    const stats = await dashboardStats(db, new Date('2026-12-15T10:00:00Z'))
    expect(stats).toMatchObject({ pendingCount: 1, weekCount: 1 })
    expect(stats.today).toHaveLength(1)
    expect(stats.nextPending).toHaveLength(1)
  })

  it('weeks start on Monday and month grids have 6 weeks', () => {
    expect(weekStart('2026-12-15')).toBe('2026-12-14')
    expect(weekStart('2026-12-20')).toBe('2026-12-14')
    const grid = monthGrid('2026-12')
    expect(grid.days).toHaveLength(42)
    expect(grid.from).toBe('2026-11-30')
  })
})
