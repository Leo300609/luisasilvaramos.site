import { describe, expect, it } from 'vitest'

import {
  composeContactMessage,
  formatBrazilianPhone,
  validateContactForm,
} from '@/lib/contact-form'

const valid = {
  name: 'Maria Souza',
  whatsapp: '(11) 91234-5678',
  eventType: 'Noiva' as const,
  eventDate: '2027-03-20',
  message: 'Casamento às 17h',
}

describe('validateContactForm', () => {
  it('accepts a complete form', () => {
    expect(validateContactForm(valid)).toMatchObject({ ok: true })
  })

  it('accepts optional fields left blank', () => {
    expect(validateContactForm({ ...valid, eventDate: '', message: '' })).toMatchObject({
      ok: true,
    })
  })

  it('reports one message per invalid field, in Portuguese', () => {
    const result = validateContactForm({
      name: ' ',
      whatsapp: '1234',
      eventType: '' as never,
      eventDate: '20/03/2027',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: 'Informe seu nome.',
        whatsapp: 'Informe um WhatsApp válido com DDD.',
        eventType: 'Escolha o tipo de evento.',
        eventDate: 'Data inválida.',
      })
    }
  })

  it.each(['11912345678', '(11) 1234-5678', '+55 11 91234-5678', '5511912345678'])(
    'accepts Brazilian phone %s',
    (whatsapp) => {
      expect(validateContactForm({ ...valid, whatsapp }).ok).toBe(true)
    },
  )

  it.each(['00912345678', '119123', '(11) 91234-56789'])('rejects phone %s', (whatsapp) => {
    expect(validateContactForm({ ...valid, whatsapp }).ok).toBe(false)
  })

  it('rejects event types that are no longer offered', () => {
    expect(validateContactForm({ ...valid, eventType: 'Aula de automaquiagem' as never }).ok).toBe(
      false,
    )
  })

  it('caps the message length', () => {
    expect(validateContactForm({ ...valid, message: 'a'.repeat(1501) }).ok).toBe(false)
  })
})

describe('formatBrazilianPhone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['1191234', '(11) 91234'],
    ['11912345', '(11) 91-2345'],
    ['11912345678', '(11) 91234-5678'],
    ['1132345678', '(11) 3234-5678'],
    ['11912345678999', '(11) 91234-5678'],
    ['(11) 9abc1234-5678', '(11) 91234-5678'],
  ])('%s → %s', (input, expected) => {
    expect(formatBrazilianPhone(input)).toBe(expected)
  })
})

describe('composeContactMessage', () => {
  it('builds a readable message with the date in Brazilian format', () => {
    const result = validateContactForm(valid)
    if (!result.ok) throw new Error('expected valid')
    expect(composeContactMessage(result.data)).toBe(
      [
        'Olá, Luísa! Vim pelo site e gostaria de conversar sobre uma maquiagem.',
        '',
        'Nome: Maria Souza',
        'WhatsApp: (11) 91234-5678',
        'Tipo de evento: Noiva',
        'Data do evento: 20/03/2027',
        '',
        'Casamento às 17h',
      ].join('\n'),
    )
  })

  it('omits optional lines when empty', () => {
    const result = validateContactForm({ ...valid, eventDate: '', message: '' })
    if (!result.ok) throw new Error('expected valid')
    const message = composeContactMessage(result.data)
    expect(message).not.toContain('Data do evento')
    expect(message.endsWith('Tipo de evento: Noiva')).toBe(true)
  })
})
