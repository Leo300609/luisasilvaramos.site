import { cookies } from 'next/headers'

import { BOOKING_COOKIE, resolveToken } from '@/server/booking/tokens'
import type { Db } from '@/server/scheduling/context'

/** Sets the "Minha agenda" cookie: HttpOnly, Secure (except local http), SameSite=Lax. */
export async function setBookingCookie(token: string, expiresAt: Date) {
  const store = await cookies()
  store.set(BOOKING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/** Booking id behind the current visitor's cookie, if valid. */
export async function bookingFromCookie(db: Db, now: Date): Promise<string | null> {
  const token = (await cookies()).get(BOOKING_COOKIE)?.value
  return token ? resolveToken(db, token, now) : null
}
