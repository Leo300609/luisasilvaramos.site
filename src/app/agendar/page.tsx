import { asc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppHeader } from '@/components/booking/app-header'
import { BookingFlow } from '@/components/booking/booking-flow'
import { StatusPage } from '@/components/status-page'
import { DEFAULT_WHATSAPP_MESSAGE, whatsappLink } from '@/lib/contact'
import { getDb } from '@/server/db/client'
import * as schema from '@/server/db/schema'
import { bookingConfigured } from '@/server/runtime'

import './booking.css'

export const metadata: Metadata = {
  title: 'Agendar horário',
  description:
    'Agende sua maquiagem com Luísa Silva Ramos, maquiadora profissional: escolha o serviço, a data e o horário em poucos passos.',
}

function Fallback() {
  return (
    <StatusPage
      kicker="Agendamento online"
      title={
        <>
          Em breve, <em className="text-gold-text italic">online</em>
        </>
      }
      description="O agendamento pelo site está quase pronto. Por enquanto, fale com a Luísa pelo WhatsApp para consultar datas, valores e reservar o seu horário."
      action={{
        href: whatsappLink(DEFAULT_WHATSAPP_MESSAGE),
        label: 'Chamar no WhatsApp',
        external: true,
      }}
      secondary={{ href: '/', label: 'Voltar ao site' }}
    />
  )
}

/** Rendered per request: /agendar is protected by the nonce-based CSP (ADR 0011). */
export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ servico?: string }>
}) {
  await connection()
  if (!bookingConfigured()) return <Fallback />

  const [{ servico }, services] = await Promise.all([
    searchParams,
    getDb()
      .select({
        id: schema.services.id,
        slug: schema.services.slug,
        name: schema.services.name,
        description: schema.services.description,
        durationMin: schema.services.durationMin,
        priceCents: schema.services.priceCents,
      })
      .from(schema.services)
      .where(eq(schema.services.active, true))
      .orderBy(asc(schema.services.sortOrder)),
  ])
  if (services.length === 0) return <Fallback />

  return (
    <div className="app">
      <AppHeader subtitle="Agendamento online" />
      <BookingFlow services={services} {...(servico ? { initialServiceSlug: servico } : {})} />
    </div>
  )
}
