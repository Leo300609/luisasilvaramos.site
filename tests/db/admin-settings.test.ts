import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  listServices,
  loadSettings,
  saveBaseAddress,
  saveHours,
  saveRules,
  saveService,
} from '@/server/admin/settings'
import { createAdminUser } from '@/server/auth/service'
import { createBooking } from '@/server/booking/create'
import { fakeCepLookup } from '@/server/booking/quote'
import { loadConfig } from '@/server/scheduling/context'

import { bookingInput, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())
const SECRET = 'test-auth-secret-0123456789abcdefghij'
let deps: { now: Date; actorId: string; secret: string; keyRing: typeof keyRing }

beforeEach(async () => {
  await resetData(db)
  const actorId = await createAdminUser(
    db,
    { email: 'l@exemplo.com', name: 'Luísa', password: 'café com pão e batom' },
    NOW,
  )
  deps = { now: NOW, actorId, secret: SECRET, keyRing }
})

describe('settings', () => {
  it('creates and edits services; existing bookings keep their price', async () => {
    await createBooking(db, bookingInput(), { now: NOW, keyRing })
    await saveService(
      db,
      1,
      {
        name: 'Maquiagem Social',
        category: 'Social',
        durationMin: 75,
        priceCents: 25000,
        active: true,
      },
      deps,
    )
    await saveService(
      db,
      null,
      {
        name: 'Maquiagem Social',
        category: 'Social',
        durationMin: 60,
        priceCents: 1000,
        active: false,
      },
      deps,
    )
    const id = await saveService(
      db,
      null,
      {
        name: 'Maquiagem Social',
        category: 'Social',
        durationMin: 60,
        priceCents: 1000,
        active: false,
      },
      deps,
    )
    const services = await listServices(db)
    expect(services.find((s) => s.id === 1)).toMatchObject({ durationMin: 75, priceCents: 25000 })
    expect(services.find((s) => s.id === id)!.slug).toBe('maquiagem-social-2')
    const [b] = await db.query.bookings.findMany()
    expect(b).toMatchObject({ priceCents: 20000, durationMin: 60 })
    await expect(
      saveService(
        db,
        1,
        { name: 'x', category: 'S', durationMin: 5, priceCents: 1, active: true },
        deps,
      ),
    ).rejects.toThrow()
  })

  it('saves weekly hours and rules that the booking engine reads', async () => {
    const hours = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isOpen: weekday !== 0,
      opensAt: '07:00',
      closesAt: '20:00',
    }))
    await saveHours(db, hours, deps)
    await expect(
      saveHours(
        db,
        hours.map((h) => ({ ...h, closesAt: '06:00' })),
        deps,
      ),
    ).rejects.toThrow()

    const current = (await loadSettings(db, keyRing)).rules
    await saveRules(
      db,
      { ...current, bufferMin: 30, travelSafetyFactor: 1.5, manualConfirmation: false },
      deps,
    )
    const config = await loadConfig(db)
    expect(config.rules.bufferMin).toBe(30)
    expect(config.travel.safetyFactor).toBe(1.5)
    expect(config.manualConfirmation).toBe(false)
    const settings = await loadSettings(db, keyRing)
    expect(settings.hours[1]).toMatchObject({ isOpen: true, opensAt: '07:00', closesAt: '20:00' })
  })

  it('stores the departure address encrypted', async () => {
    const r = await saveBaseAddress(
      db,
      { cep: '01310-100', number: '50' },
      { ...deps, lookup: fakeCepLookup },
    )
    expect(r).toMatchObject({ ok: true })
    expect((await loadSettings(db, keyRing)).baseAddress).toContain('Rua de Teste, 50')
    const raw = await db.query.scheduleSettings.findFirst()
    expect(raw!.baseAddressEnc).not.toContain('Rua de Teste')
    await expect(
      saveBaseAddress(db, { cep: '99999-999', number: '1' }, { ...deps, lookup: fakeCepLookup }),
    ).resolves.toEqual({ ok: false, reason: 'cep-not-found' })
  })
})
