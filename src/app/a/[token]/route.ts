import { NextResponse } from 'next/server'

import { BOOKING_COOKIE, resolveToken } from '@/server/booking/tokens'
import { getDb } from '@/server/db/client'
import { bookingConfigured } from '@/server/runtime'

/**
 * Secret link from e-mails: validates the token, stores it in an HttpOnly cookie
 * and redirects to a clean URL, so the token does not stay in history or leak
 * through the Referer header (proxy also sets Referrer-Policy: no-referrer).
 */
export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const target = new URL('/agendar/minha-agenda', request.url)
  if (!bookingConfigured()) return NextResponse.redirect(target)
  const bookingId = await resolveToken(getDb(), token, new Date())
  if (!bookingId) {
    target.searchParams.set('link', 'invalido')
    return NextResponse.redirect(target)
  }
  const response = NextResponse.redirect(target)
  response.cookies.set(BOOKING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  })
  return response
}
