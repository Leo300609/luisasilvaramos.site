import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { requestAccessLink } from '@/server/booking/access'
import { createBooking } from '@/server/booking/create'
import { cancelByClient, rescheduleByClient } from '@/server/booking/manage'
import { resolveToken } from '@/server/booking/tokens'
import * as schema from '@/server/db/schema'
import { MailerError, MemoryMailer } from '@/server/email/mailer'
import { deliverDueEmails, MAX_ATTEMPTS, type DeliveryDeps } from '@/server/email/outbox'
import { addMinutes } from '@/server/scheduling/time'

import { bookingInput, DAY, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())
beforeEach(() => resetData(db))

const ADMIN = 'luisa@exemplo.com'

function deps(mailer: MemoryMailer, now = NOW): DeliveryDeps {
  return { mailer, keyRing, siteUrl: 'https://site.test', adminEmail: ADMIN, now }
}

const outbox = () => db.select().from(schema.emailOutbox).orderBy(schema.emailOutbox.createdAt)

/** Extracts the "Minha agenda" token from a sent e-mail. */
const tokenIn = (text: string) => /https:\/\/site\.test\/a\/([A-Za-z0-9_-]{43})/.exec(text)?.[1]

describe('e-mail outbox', () => {
  it('queues client and Luísa e-mails in the booking transaction, once', async () => {
    const input = bookingInput()
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    await createBooking(db, input, { now: NOW, keyRing }) // idempotent replay
    const rows = await outbox()
    expect(rows.map((r) => `${r.kind}:${r.recipient}`).sort()).toEqual([
      'booking_created:cliente',
      'booking_created:luisa',
    ])
    expect(rows.every((r) => r.bookingId === id && r.status === 'pendente')).toBe(true)
  })

  it('stores no personal data in the outbox', async () => {
    await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const dump = JSON.stringify(await outbox())
    expect(dump).not.toMatch(/Cliente Teste|@exemplo\.com|Rua Exemplo/)
  })

  it('sends rendered e-mails with a working, freshly minted link', async () => {
    const input = bookingInput()
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    const mailer = new MemoryMailer()
    const report = await deliverDueEmails(db, deps(mailer))
    expect(report).toEqual({ sent: 2, retried: 0, failed: 0, discarded: 0 })

    const client = mailer.sent.find((m) => m.to === input.customer.email)!
    expect(client.subject).toMatch(/^Recebemos seu pedido/)
    expect(client.text).toContain('LSR-0001')
    expect(client.text).toMatch(/R\$\s230,00/)
    const token = tokenIn(client.text)
    expect(token).toBeDefined()
    await expect(resolveToken(db, token!, NOW)).resolves.toBe(id)

    const admin = mailer.sent.find((m) => m.to === ADMIN)!
    expect(admin.subject).toMatch(/^Novo pedido/)
    expect(admin.text).toContain(input.customer.name)
    expect(tokenIn(admin.text)).toBeUndefined() // Luísa never gets the client's link

    expect((await outbox()).every((r) => r.status === 'enviado' && r.sentAt)).toBe(true)
    // Nothing left to send.
    await expect(deliverDueEmails(db, deps(mailer))).resolves.toMatchObject({ sent: 0 })
  })

  it('never sends allergy notes by e-mail, only a flag', async () => {
    await createBooking(
      db,
      bookingInput({ allergyNotes: 'Alergia a látex', allergyConsent: true }),
      { now: NOW, keyRing },
    )
    const mailer = new MemoryMailer()
    await deliverDueEmails(db, deps(mailer))
    const all = mailer.sent.map((m) => m.text + m.html).join('\n')
    expect(all).not.toContain('látex')
    expect(mailer.sent.find((m) => m.to === ADMIN)!.text).toMatch(/alergias/)
  })

  it('retries transient failures with backoff and gives up after the last attempt', async () => {
    await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const mailer = new MemoryMailer()
    mailer.failWith = new MailerError('resend: HTTP 503', false)

    let now = NOW
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      const report = await deliverDueEmails(db, deps(mailer, now))
      expect(report.retried).toBe(2)
      // Not due again right away.
      await expect(deliverDueEmails(db, deps(mailer, now))).resolves.toMatchObject({ retried: 0 })
      now = addMinutes(now, 6 * 60)
    }
    const last = await deliverDueEmails(db, deps(mailer, now))
    expect(last.failed).toBe(2)
    const rows = await outbox()
    expect(rows.every((r) => r.status === 'falhou' && r.attempts === MAX_ATTEMPTS)).toBe(true)
    expect(rows[0]!.lastError).toBe('resend: HTTP 503')
  })

  it('stops at once on permanent failures', async () => {
    await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const mailer = new MemoryMailer()
    mailer.failWith = new MailerError('resend: HTTP 422', true)
    await expect(deliverDueEmails(db, deps(mailer))).resolves.toMatchObject({ failed: 2 })
  })

  it('discards stale messages and Luísa e-mails without an address', async () => {
    await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const mailer = new MemoryMailer()
    const noAdmin = { ...deps(mailer), adminEmail: null }
    await expect(deliverDueEmails(db, noAdmin)).resolves.toMatchObject({ sent: 1, discarded: 1 })

    await createBooking(db, bookingInput({ time: '14:00' }), { now: NOW, keyRing })
    const late = deps(new MemoryMailer(), addMinutes(NOW, 4 * 24 * 60))
    await expect(deliverDueEmails(db, late)).resolves.toMatchObject({ sent: 0, discarded: 2 })
  })

  it('leaves e-mails queued when no transport is configured', async () => {
    await createBooking(db, bookingInput(), { now: NOW, keyRing })
    const report = await deliverDueEmails(db, { ...deps(new MemoryMailer()), mailer: null })
    expect(report.sent).toBe(0)
    expect((await outbox()).every((r) => r.status === 'pendente' && r.attempts === 0)).toBe(true)
  })

  it('never sends the same row twice under concurrent runs', async () => {
    for (const time of ['09:00', '14:00', '17:00']) {
      await createBooking(db, bookingInput({ time }), { now: NOW, keyRing })
    }
    const mailer = new MemoryMailer()
    await Promise.all(Array.from({ length: 4 }, () => deliverDueEmails(db, deps(mailer), 2)))
    await deliverDueEmails(db, deps(mailer))
    expect(mailer.sent).toHaveLength(6)
    expect(new Set(mailer.sent.map((m) => m.idempotencyKey)).size).toBe(6)
  })

  it('announces cancellations and reschedules to both sides', async () => {
    const a = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    const b = await createBooking(db, bookingInput({ time: '14:00' }), { now: NOW, keyRing })
    await cancelByClient(db, a.id, { now: NOW })
    await rescheduleByClient(db, b.id, { date: DAY, time: '16:00' }, { now: NOW })
    const mailer = new MemoryMailer()
    await deliverDueEmails(db, deps(mailer))
    const subjects = mailer.sent.map((m) => m.subject)
    expect(subjects.filter((s) => s.startsWith('Agendamento cancelado'))).toHaveLength(1)
    expect(subjects.filter((s) => s.startsWith('Cancelado pela cliente'))).toHaveLength(1)
    const moved = mailer.sent.find((m) => m.subject.startsWith('Agendamento remarcado'))!
    expect(moved.text).toMatch(/09:00|14:00/)
    expect(subjects.filter((s) => s.startsWith('Remarcado pela cliente'))).toHaveLength(1)
  })
})

describe('access link ("Perdi o link")', () => {
  it('e-mails a working link to the address on file, with the same outcome for unknown ones', async () => {
    const input = bookingInput()
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    await expect(requestAccessLink(db, 'ninguem@exemplo.com', NOW)).resolves.toBe(0)
    await expect(requestAccessLink(db, input.customer.email.toUpperCase(), NOW)).resolves.toBe(1)

    const mailer = new MemoryMailer()
    await deliverDueEmails(db, deps(mailer))
    const mail = mailer.sent.find((m) => m.subject === 'Seu link da Minha agenda')!
    expect(mail.to).toBe(input.customer.email)
    await expect(resolveToken(db, tokenIn(mail.text)!, NOW)).resolves.toBe(id)
  })

  it('throttles repeated requests', async () => {
    const input = bookingInput()
    await createBooking(db, input, { now: NOW, keyRing })
    const email = input.customer.email
    await expect(requestAccessLink(db, email, NOW)).resolves.toBe(1)
    await expect(requestAccessLink(db, email, addMinutes(NOW, 1))).resolves.toBe(0) // cooldown
    await expect(requestAccessLink(db, email, addMinutes(NOW, 3))).resolves.toBe(1)
    await expect(requestAccessLink(db, email, addMinutes(NOW, 6))).resolves.toBe(1)
    await expect(requestAccessLink(db, email, addMinutes(NOW, 9))).resolves.toBe(0) // 3/hour
    await expect(requestAccessLink(db, email, addMinutes(NOW, 70))).resolves.toBe(1)
  })

  it('ignores customers without upcoming bookings', async () => {
    const input = bookingInput()
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    await db
      .update(schema.bookings)
      .set({ status: 'cancelado', cancelReason: 'pedido_cliente' })
      .where(eq(schema.bookings.id, id))
    await expect(requestAccessLink(db, input.customer.email, NOW)).resolves.toBe(0)
  })
})
