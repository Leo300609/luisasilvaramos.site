import type { Metadata } from 'next'
import { connection } from 'next/server'

import { StatusPage } from '@/components/status-page'
import { DEFAULT_WHATSAPP_MESSAGE, whatsappLink } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'Agendar horário',
  description:
    'Agende sua maquiagem com Luísa Silva Ramos, maquiadora profissional: escolha o serviço, a data e o horário em poucos passos.',
}

/**
 * Temporary page until the online booking flow ships (Phase 4).
 * Rendered per request: /agendar is protected by the nonce-based CSP (ADR 0011).
 */
export default async function AgendarPage() {
  await connection()
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
