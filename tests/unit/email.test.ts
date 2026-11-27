import { describe, expect, it, vi } from 'vitest'

import { escapeHtml, renderEmail } from '@/server/email/layout'
import { MailerError, ResendMailer } from '@/server/email/mailer'
import {
  adminBookingCreated,
  clientBookingCreated,
  deadlineLabel,
  type BookingSummary,
} from '@/server/email/templates'

const booking: BookingSummary = {
  code: 'LSR-0007',
  status: 'pendente',
  serviceName: 'Maquiagem Social',
  durationMin: 60,
  date: '2026-12-15',
  time: '09:00',
  endTime: '10:00',
  eventStart: '19:00',
  eventDuration: '4_6h',
  address: 'Rua Exemplo, 100',
  complement: 'Apto 12',
  priceCents: 20000,
  travelFeeCents: 3000,
  totalCents: 23000,
  changeDeadline: '2026-12-13T12:00:00.000Z',
}
const customer = { name: 'Ana <b>Souza</b>', phone: '+5511999998888', email: 'ana@exemplo.com' }

describe('e-mail layout', () => {
  it('escapes every dynamic value', () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    )
    const email = adminBookingCreated(booking, {
      customer,
      lookNotes: '"><img src=x onerror=alert(1)>',
      hasAllergyNotes: false,
      whatsappToClient: 'https://wa.me/5511999998888',
    })
    expect(email.html).not.toContain('<b>Souza</b>')
    expect(email.html).toContain('Ana &lt;b&gt;Souza&lt;/b&gt;')
    expect(email.html).not.toContain('<img')
  })

  it('refuses non-http links in buttons', () => {
    expect(() =>
      renderEmail({
        subject: 's',
        preheader: 'p',
        heading: 'h',
        blocks: [{ type: 'button', href: 'javascript:alert(1)', label: 'x' }],
      }),
    ).toThrow()
  })

  it('renders a plain-text alternative with the same content', () => {
    const email = clientBookingCreated(booking, {
      customer,
      link: 'https://site.test/a/abc',
      whatsappUrl: 'https://wa.me/5511930546322',
      pendingExpiryHours: 24,
    })
    expect(email.text).toContain('Ver meu agendamento: https://site.test/a/abc')
    expect(email.text).toContain('Código: LSR-0007')
    expect(email.text).toContain('Seu evento: 19:00 · 4 a 6 horas')
    expect(email.text).toContain('até 13 de dezembro, às 09:00')
    expect(email.text).toContain('em até 24 horas')
  })
})

describe('templates', () => {
  it('switches the client e-mail between pending and confirmed', () => {
    const ctx = {
      customer,
      link: 'https://site.test/a/abc',
      whatsappUrl: 'https://wa.me/5511930546322',
      pendingExpiryHours: 24,
    }
    expect(clientBookingCreated(booking, ctx).subject).toMatch(/^Recebemos seu pedido/)
    expect(clientBookingCreated({ ...booking, status: 'confirmado' }, ctx).subject).toMatch(
      /^Agendamento confirmado/,
    )
  })

  it('formats the change deadline in São Paulo time', () => {
    expect(deadlineLabel('2026-12-13T12:00:00.000Z')).toBe('13 de dezembro, às 09:00')
  })

  it('tells the Luísa about allergies without their content', () => {
    const email = adminBookingCreated(booking, {
      customer,
      lookNotes: 'Pele seca',
      hasAllergyNotes: true,
      whatsappToClient: 'https://wa.me/5511999998888',
    })
    expect(email.text).toContain('Sobre o look: Pele seca')
    expect(email.text).toMatch(/alergias.*painel/)
  })
})

describe('ResendMailer', () => {
  const message = {
    to: 'ana@exemplo.com',
    subject: 'Oi',
    html: '<p>Oi</p>',
    text: 'Oi',
    idempotencyKey: 'lsr-1',
  }

  it('posts to Resend with the idempotency key and returns the id', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: 'msg_1' }))
    const mailer = new ResendMailer('re_test_1234567890', 'Luísa <a@b.com>', fetchImpl)
    await expect(mailer.send(message)).resolves.toEqual({ id: 'msg_1' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('lsr-1')
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['ana@exemplo.com'] })
  })

  it.each([
    [429, false],
    [500, false],
    [422, true],
    [401, true],
  ])('classifies HTTP %i (permanent: %s)', async (status, permanent) => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"ana@exemplo.com"}', { status }))
    const mailer = new ResendMailer('re_test_1234567890', 'Luísa <a@b.com>', fetchImpl)
    const error = await mailer.send(message).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MailerError)
    expect((error as MailerError).permanent).toBe(permanent)
    expect((error as MailerError).message).not.toContain('@') // no provider text, no PII
  })

  it('treats network errors as transient', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const mailer = new ResendMailer('re_test_1234567890', 'Luísa <a@b.com>', fetchImpl)
    await expect(mailer.send(message)).rejects.toMatchObject({ permanent: false })
  })
})
