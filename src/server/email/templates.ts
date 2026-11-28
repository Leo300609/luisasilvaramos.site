/**
 * Transactional e-mail texts (pt-BR). Pure functions: data in, rendered e-mail
 * out, so every message is unit-tested without a database or a provider.
 */
import {
  eventDurationLabel,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatMoney,
} from '@/lib/format'

import { renderEmail, type Block, type RenderedEmail } from './layout'

export type BookingSummary = {
  code: string
  status: 'pendente' | 'confirmado' | 'concluido' | 'cancelado'
  serviceName: string
  durationMin: number
  date: string
  time: string
  endTime: string
  eventStart: string | null
  eventDuration: string | null
  address: string
  complement: string | null
  priceCents: number
  travelFeeCents: number
  totalCents: number
  /** ISO instant after which online changes are no longer allowed. */
  changeDeadline: string
}

export type CustomerInfo = { name: string; phone: string; email: string }

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** "13 de dezembro, às 09:00" in São Paulo time. */
export function deadlineLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${get('day')} de ${get('month')}, às ${get('hour')}:${get('minute')}`
}

function whenRows(b: BookingSummary): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Serviço', `${b.serviceName} (${formatDuration(b.durationMin)})`],
    ['Data', formatDateLong(b.date)],
    ['Horário', `${b.time} às ${b.endTime}`],
  ]
  if (b.eventStart) {
    const duration = eventDurationLabel(b.eventDuration)
    rows.push(['Seu evento', `${b.eventStart}${duration ? ` · ${duration.toLowerCase()}` : ''}`])
  }
  rows.push(['Local', b.complement ? `${b.address}\n${b.complement}` : b.address])
  return rows
}

function priceRows(b: BookingSummary): Array<[string, string]> {
  return [
    ['Serviço', formatMoney(b.priceCents)],
    ['Deslocamento', formatMoney(b.travelFeeCents)],
    ['Total', formatMoney(b.totalCents)],
  ]
}

const codeRow = (b: BookingSummary): [string, string] => ['Código', b.code]

// ── Client ───────────────────────────────────────────────────────────────────

export function clientBookingCreated(
  b: BookingSummary,
  ctx: { customer: CustomerInfo; link: string; whatsappUrl: string; pendingExpiryHours: number },
): RenderedEmail {
  const confirmed = b.status === 'confirmado'
  const intro: Block[] = confirmed
    ? [{ type: 'p', text: `Olá, ${firstName(ctx.customer.name)}! Seu horário está confirmado.` }]
    : [
        {
          type: 'p',
          text: `Olá, ${firstName(ctx.customer.name)}! Recebi o seu pedido e o horário fica reservado enquanto eu confirmo.`,
        },
        {
          type: 'note',
          text: `Você recebe a confirmação por e-mail em até ${ctx.pendingExpiryHours} horas.`,
        },
      ]
  return renderEmail({
    subject: confirmed
      ? `Agendamento confirmado · ${formatDateShort(b.date)}, ${b.time}`
      : `Recebemos seu pedido · ${formatDateShort(b.date)}, ${b.time}`,
    preheader: `${b.serviceName} em ${formatDateLong(b.date)}, às ${b.time}. Código ${b.code}.`,
    heading: confirmed ? 'Agendamento confirmado' : 'Pedido recebido',
    blocks: [
      ...intro,
      { type: 'details', rows: [codeRow(b), ...whenRows(b)] },
      { type: 'details', rows: priceRows(b) },
      {
        type: 'p',
        text: 'Pelo link abaixo você vê os detalhes, adiciona ao seu calendário e, se precisar, cancela ou remarca.',
      },
      { type: 'button', href: ctx.link, label: 'Ver meu agendamento' },
      {
        type: 'note',
        text: `Cancelamentos e remarcações online até ${deadlineLabel(b.changeDeadline)}. Depois disso, fale comigo pelo WhatsApp.`,
      },
      { type: 'p', text: 'No dia, esteja com o rosto limpo e sem maquiagem.' },
      { type: 'p', text: `Dúvidas? WhatsApp: ${ctx.whatsappUrl}` },
      {
        type: 'note',
        text: 'Esse link é pessoal: quem tiver acesso a ele pode alterar o seu agendamento. Não compartilhe.',
      },
    ],
  })
}

export function clientBookingCancelled(
  b: BookingSummary,
  ctx: { customer: CustomerInfo; bookUrl: string; whatsappUrl: string },
): RenderedEmail {
  return renderEmail({
    subject: `Agendamento cancelado · ${b.code}`,
    preheader: `O atendimento de ${formatDateLong(b.date)}, às ${b.time}, foi cancelado.`,
    heading: 'Agendamento cancelado',
    blocks: [
      {
        type: 'p',
        text: `Olá, ${firstName(ctx.customer.name)}. O seu agendamento foi cancelado e o horário foi liberado.`,
      },
      { type: 'details', rows: [codeRow(b), ...whenRows(b).slice(0, 3)] },
      { type: 'p', text: 'Se quiser marcar outra data, é só agendar de novo:' },
      { type: 'button', href: ctx.bookUrl, label: 'Agendar outra data' },
      { type: 'p', text: `Se não foi você quem cancelou, fale comigo: ${ctx.whatsappUrl}` },
    ],
  })
}

export function clientBookingRescheduled(
  b: BookingSummary,
  ctx: { customer: CustomerInfo; link: string; previous: string; whatsappUrl: string },
): RenderedEmail {
  const pending = b.status === 'pendente'
  return renderEmail({
    subject: `Agendamento remarcado · ${formatDateShort(b.date)}, ${b.time}`,
    preheader: `Novo horário: ${formatDateLong(b.date)}, às ${b.time}.`,
    heading: 'Agendamento remarcado',
    blocks: [
      {
        type: 'p',
        text: `Olá, ${firstName(ctx.customer.name)}! Seu atendimento mudou de ${ctx.previous} para o horário abaixo.`,
      },
      ...(pending
        ? [{ type: 'note', text: 'Vou confirmar o novo horário e te aviso por e-mail.' } as Block]
        : []),
      { type: 'details', rows: [codeRow(b), ...whenRows(b)] },
      { type: 'button', href: ctx.link, label: 'Ver meu agendamento' },
      { type: 'p', text: `Se não foi você quem remarcou, fale comigo: ${ctx.whatsappUrl}` },
    ],
  })
}

export function clientAccessLink(ctx: {
  customer: CustomerInfo
  bookings: Array<{ summary: BookingSummary; link: string }>
}): RenderedEmail {
  return renderEmail({
    subject: 'Seu link da Minha agenda',
    preheader: 'O link para ver e gerenciar o seu agendamento.',
    heading: 'Seu link de acesso',
    blocks: [
      {
        type: 'p',
        text: `Olá, ${firstName(ctx.customer.name)}! Aqui está o link que você pediu.`,
      },
      ...ctx.bookings.flatMap(({ summary, link }): Block[] => [
        { type: 'details', rows: [codeRow(summary), ...whenRows(summary).slice(0, 3)] },
        { type: 'button', href: link, label: `Abrir ${summary.code}` },
      ]),
      {
        type: 'note',
        text: 'Os links anteriores continuam valendo. Se você não pediu este e-mail, pode ignorá-lo: ninguém mais o recebeu.',
      },
    ],
  })
}

// ── Luísa ────────────────────────────────────────────────────────────────────

function customerRows(c: CustomerInfo): Array<[string, string]> {
  return [
    ['Cliente', c.name],
    ['WhatsApp', c.phone],
    ['E-mail', c.email],
  ]
}

export function adminBookingCreated(
  b: BookingSummary,
  ctx: {
    customer: CustomerInfo
    lookNotes: string | null
    hasAllergyNotes: boolean
    whatsappToClient: string
  },
): RenderedEmail {
  const pending = b.status === 'pendente'
  return renderEmail({
    subject: `${pending ? 'Novo pedido' : 'Novo agendamento'} · ${formatDateShort(b.date)}, ${b.time} · ${b.code}`,
    preheader: `${ctx.customer.name} · ${b.serviceName}`,
    heading: pending ? 'Novo pedido de agendamento' : 'Novo agendamento',
    blocks: [
      ...(pending
        ? [
            {
              type: 'note',
              text: 'O horário fica reservado até você confirmar ou recusar. Se não responder no prazo, o pedido expira.',
            } as Block,
          ]
        : []),
      { type: 'details', rows: [codeRow(b), ...whenRows(b)] },
      { type: 'details', rows: [...customerRows(ctx.customer), ...priceRows(b)] },
      ...(ctx.lookNotes ? [{ type: 'p', text: `Sobre o look: ${ctx.lookNotes}` } as Block] : []),
      ...(ctx.hasAllergyNotes
        ? [
            {
              type: 'note',
              text: 'A cliente informou alergias ou sensibilidades. Por serem dados de saúde, elas não vão por e-mail: veja no painel.',
            } as Block,
          ]
        : []),
      { type: 'button', href: ctx.whatsappToClient, label: 'Falar com a cliente' },
    ],
  })
}

export function adminBookingCancelled(
  b: BookingSummary,
  ctx: { customer: CustomerInfo },
): RenderedEmail {
  return renderEmail({
    subject: `Cancelado pela cliente · ${formatDateShort(b.date)}, ${b.time} · ${b.code}`,
    preheader: `${ctx.customer.name} cancelou. O horário foi liberado.`,
    heading: 'Agendamento cancelado',
    blocks: [
      { type: 'p', text: `${ctx.customer.name} cancelou pelo site. O horário já está livre.` },
      {
        type: 'details',
        rows: [codeRow(b), ...whenRows(b).slice(0, 3), ...customerRows(ctx.customer)],
      },
    ],
  })
}

export function adminBookingRescheduled(
  b: BookingSummary,
  ctx: { customer: CustomerInfo; previous: string },
): RenderedEmail {
  return renderEmail({
    subject: `Remarcado pela cliente · ${formatDateShort(b.date)}, ${b.time} · ${b.code}`,
    preheader: `${ctx.customer.name} remarcou de ${ctx.previous}.`,
    heading: 'Agendamento remarcado',
    blocks: [
      {
        type: 'p',
        text: `${ctx.customer.name} remarcou pelo site. Antes: ${ctx.previous}.${b.status === 'pendente' ? ' O novo horário aguarda a sua confirmação.' : ''}`,
      },
      { type: 'details', rows: [codeRow(b), ...whenRows(b), ...customerRows(ctx.customer)] },
    ],
  })
}
