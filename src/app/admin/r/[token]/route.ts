import { NextResponse } from 'next/server'

import { RESET_COOKIE } from '../../(acesso)/reset-cookie'

/**
 * Password-reset link from the e-mail: moves the token into a short-lived,
 * HttpOnly cookie scoped to /admin and redirects to a clean URL (no token in
 * history or Referer). The token is validated on the next page.
 */
export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const response = NextResponse.redirect(new URL('/admin/redefinir', request.url))
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    response.cookies.set(RESET_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/admin',
      maxAge: 30 * 60,
    })
  }
  return response
}
