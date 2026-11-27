import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppHeader } from '@/components/booking/app-header'
import { MyBooking } from '@/components/booking/my-booking'
import { StatusPage } from '@/components/status-page'
import { env } from '@/env/server'
import { getClientBooking } from '@/server/booking/manage'
import { googleCalendarLink } from '@/server/booking/ics'
import { getDb } from '@/server/db/client'
import { bookingFromCookie } from '@/server/http/booking-cookie'
import { bookingConfigured, getKeyRing } from '@/server/runtime'

import '../booking.css'

export const metadata: Metadata = {
  title: 'Minha agenda',
  robots: { index: false, follow: false },
}

export default async function MinhaAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; link?: string }>
}) {
  await connection()
  const params = await searchParams
  const now = new Date()
  const db = bookingConfigured() ? getDb() : null
  const bookingId = db ? await bookingFromCookie(db, now) : null
  const booking =
    db && bookingId ? await getClientBooking(db, bookingId, { keyRing: getKeyRing(), now }) : null

  if (!booking) {
    return (
      <StatusPage
        kicker="Minha agenda"
        title="Agendamento não encontrado"
        description={
          params.link === 'invalido'
            ? 'Esse link expirou ou não é mais válido. Use o link mais recente que enviamos por e-mail ou fale com a Luísa pelo WhatsApp.'
            : 'Para ver o seu agendamento, abra o link que enviamos por e-mail depois da confirmação. Se preferir, fale com a Luísa pelo WhatsApp.'
        }
        action={{ href: '/agendar', label: 'Fazer um agendamento' }}
        secondary={{ href: '/', label: 'Voltar ao site' }}
      />
    )
  }

  const calendar = googleCalendarLink({
    uid: booking.id,
    title: `Maquiagem com Luísa Silva Ramos (${booking.serviceName})`,
    description: `${booking.code}. Esteja com o rosto limpo no horário combinado.`,
    location: booking.address,
    start: new Date(booking.startsAt),
    end: new Date(booking.endsAt),
    url: new URL('/agendar/minha-agenda', env.NEXT_PUBLIC_SITE_URL).toString(),
  })

  return (
    <div className="app">
      <AppHeader subtitle="Minha agenda" />
      <MyBooking booking={booking} justCreated={params.novo === '1'} googleCalendarUrl={calendar} />
      <footer className="app-footer">
        © {now.getFullYear()} Luísa Silva Ramos · Maquiadora Profissional
      </footer>
    </div>
  )
}
