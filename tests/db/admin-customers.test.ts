import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  anonymizeCustomer,
  exportCustomer,
  getCustomer,
  listCustomers,
  saveCustomerNotes,
} from '@/server/admin/customers'
import { createAdminUser } from '@/server/auth/service'
import { createBooking } from '@/server/booking/create'
import { getClientBooking } from '@/server/booking/manage'
import { issueToken, resolveToken } from '@/server/booking/tokens'
import * as schema from '@/server/db/schema'
import { addMinutes } from '@/server/scheduling/time'

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

describe('clients', () => {
  it('lists, searches and shows the history with notes', async () => {
    const input = bookingInput({ allergyNotes: 'Látex', allergyConsent: true })
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    const list = await listCustomers(db, { q: input.customer.name.split(' ')[2], page: 1 })
    expect(list.total).toBe(1)
    await saveCustomerNotes(db, b!.customerId, 'Pele oleosa', deps)
    const profile = await getCustomer(db, b!.customerId, keyRing)
    expect(profile).toMatchObject({ notes: 'Pele oleosa', stats: { total: 1 } })
  })

  it('exports everything decrypted (LGPD access)', async () => {
    const { id } = await createBooking(
      db,
      bookingInput({ allergyNotes: 'Látex', allergyConsent: true }),
      { now: NOW, keyRing },
    )
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    const data = await exportCustomer(db, b!.customerId, deps)
    expect(data!.agendamentos[0]).toMatchObject({
      alergias: 'Látex',
      endereco: 'Rua Exemplo, 100, Centro, São Paulo',
    })
  })

  it('anonymises only without upcoming bookings, and kills her links', async () => {
    const input = bookingInput()
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    await expect(anonymizeCustomer(db, b!.customerId, deps)).rejects.toThrow(/atendimento futuro/)

    const { token } = await issueToken(db, id, addMinutes(NOW, 60 * 24 * 60))
    const later = { ...deps, now: addMinutes(b!.endsAt, 60) }
    await anonymizeCustomer(db, b!.customerId, later)
    const [c] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, b!.customerId))
    expect(c).toMatchObject({ name: 'Cliente removida', email: '' })
    expect(JSON.stringify(c)).not.toContain(input.customer.email)
    const view = await getClientBooking(db, id, { keyRing, now: later.now })
    expect(view).toMatchObject({ address: '', priceCents: 20000 })
    await expect(resolveToken(db, token, later.now)).resolves.toBeNull()
    expect((await listCustomers(db, { page: 1 })).total).toBe(0)
  })
})
