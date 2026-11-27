import { NextResponse, type NextRequest } from 'next/server'

import {
  NOINDEX_PATH_PREFIXES,
  NO_REFERRER_PATH_PREFIXES,
  buildCsp,
  matchesPrefix,
} from '@/lib/security/headers'

/**
 * Runs before the dynamic areas (booking flow, admin panel, token links) and
 * attaches a fresh nonce-based Content-Security-Policy to each request.
 * Static public pages get their (static) CSP from next.config.ts instead.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === 'development' })
  const { pathname } = request.nextUrl

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Next.js reads the nonce from this request header while rendering.
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'private, no-store')

  if (matchesPrefix(pathname, NOINDEX_PATH_PREFIXES)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
  if (matchesPrefix(pathname, NO_REFERRER_PATH_PREFIXES)) {
    response.headers.set('Referrer-Policy', 'no-referrer')
  }
  return response
}

export const config = {
  matcher: [
    {
      source: '/(agendar|admin|a)/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    {
      source: '/(agendar|admin)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
