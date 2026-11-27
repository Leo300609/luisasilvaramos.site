import { EVENT_TYPES } from '@/content/site'

/**
 * Contact form ("Vamos conversar").
 *
 * Phase 2: after validation, the message is composed and opened in WhatsApp
 * (wa.me), which is where the Luísa answers. Nothing is stored by us yet.
 * Phase 4 adds server-side lead storage, e-mail notification and anti-spam
 * (see docs/fase-0-descoberta.md); the server will re-validate with Zod.
 *
 * This validator runs in the browser, so it is plain TypeScript: shipping Zod to
 * the client would add ~40 KB of JavaScript to the home page.
 */

export type EventType = (typeof EVENT_TYPES)[number]

export type ContactFormInput = {
  name: string
  whatsapp: string
  eventType: EventType | ''
  eventDate?: string
  message?: string
}

export type ContactFormData = {
  name: string
  whatsapp: string
  eventType: EventType
  eventDate?: string
  message?: string
}

export type ContactFormErrors = Partial<Record<keyof ContactFormInput, string>>

const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function isValidBrazilianPhone(value: string): boolean {
  const digits = onlyDigits(value).replace(/^55(?=\d{10,11}$)/, '')
  return /^[1-9]{2}9?\d{8}$/.test(digits)
}

function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value)
}

export function validateContactForm(
  input: ContactFormInput,
): { ok: true; data: ContactFormData } | { ok: false; errors: ContactFormErrors } {
  const errors: ContactFormErrors = {}
  const name = input.name.trim()
  const whatsapp = input.whatsapp.trim()
  const eventDate = input.eventDate?.trim() ?? ''
  const message = input.message?.trim() ?? ''

  if (name.length < 3 || !/\p{L}/u.test(name)) errors.name = 'Informe seu nome.'
  else if (name.length > 120) errors.name = 'Nome muito longo.'
  if (!isValidBrazilianPhone(whatsapp)) errors.whatsapp = 'Informe um WhatsApp válido com DDD.'
  if (!isEventType(input.eventType)) errors.eventType = 'Escolha o tipo de evento.'
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) errors.eventDate = 'Data inválida.'
  if (message.length > 1500) errors.message = 'Mensagem muito longa (máx. 1.500 caracteres).'

  if (Object.keys(errors).length > 0 || !isEventType(input.eventType)) return { ok: false, errors }
  return {
    ok: true,
    data: {
      name,
      whatsapp,
      eventType: input.eventType,
      ...(eventDate ? { eventDate } : {}),
      ...(message ? { message } : {}),
    },
  }
}

/** Formats a digit string as (11) 91234-5678 while the user types. */
export function formatBrazilianPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  // Same rule as the design: the dash appears only once there are more than 7 digits.
  if (rest.length <= 5) return `(${ddd}) ${rest}`
  const split = rest.length - 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

/** Plain-text WhatsApp message built from the validated form. */
export function composeContactMessage(data: ContactFormData): string {
  const lines = [
    'Olá, Luísa! Vim pelo site e gostaria de conversar sobre uma maquiagem.',
    '',
    `Nome: ${data.name}`,
    `WhatsApp: ${data.whatsapp}`,
    `Tipo de evento: ${data.eventType}`,
  ]
  if (data.eventDate) lines.push(`Data do evento: ${formatDateBr(data.eventDate)}`)
  if (data.message) lines.push('', data.message)
  return lines.join('\n')
}
