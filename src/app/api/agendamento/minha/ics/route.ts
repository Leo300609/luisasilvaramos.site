import { buildIcs } from '@/server/booking/ics'
import { getClientBooking } from '@/server/booking/manage'
import { getDb } from '@/server/db/client'
import { bookingFromCookie } from '@/server/http/booking-cookie'
import { json, unavailable } from '@/server/http/guards'
import { bookingConfigured, getKeyRing } from '@/server/runtime'
import { env } from '@/env/server'

export const dynamic = 'force-dynamic'

/** Downloads the visitor's own booking as an .ics file (Apple Calendar, Outlook…). */
export async function GET() {
  if (!bookingConfigured()) return unavailable()
  const db = getDb()
  const now = new Date()
  const bookingId = await bookingFromCookie(db, now)
  const booking = bookingId
    ? await getClientBooking(db, bookingId, { keyRing: getKeyRing(), now })
    : null
  if (!booking) return json({ error: 'not-found' }, { status: 404 })
  const ics = buildIcs({
    uid: `${booking.id}@luisasilvaramos.com.br`,
    title: `Maquiagem com Luísa Silva Ramos (${booking.serviceName})`,
    description: `${booking.code} · ${booking.serviceName}. Esteja com o rosto limpo no horário combinado.`,
    location: booking.address,
    start: new Date(booking.startsAt),
    end: new Date(booking.endsAt),
    url: new URL('/agendar/minha-agenda', env.NEXT_PUBLIC_SITE_URL).toString(),
  })
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${booking.code}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
