/**
 * Security headers shared by next.config.ts (static pages) and proxy.ts
 * (dynamic pages with a per-request nonce). See docs/adr/0011-csp-hibrida.md.
 */

export type CspOptions = {
  /** Per-request nonce. When absent, the policy allows inline scripts (static pages only). */
  nonce?: string
  isDev: boolean
}

/** Third-party origins allowed by the CSP. Add here (and in the ADR) when a new service is used. */
const THIRD_PARTY = {
  script: [] as string[],
  connect: [] as string[],
  frame: [] as string[],
  img: [] as string[],
}

export function buildCsp({ nonce, isDev }: CspOptions): string {
  const scriptSrc = nonce
    ? [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`]
    : [`'self'`, `'unsafe-inline'`, ...THIRD_PARTY.script]
  if (isDev) scriptSrc.push(`'unsafe-eval'`)

  // With a nonce, <style> elements must carry it; dev tooling injects styles without one.
  const styleSrc = nonce && !isDev ? [`'self'`, `'nonce-${nonce}'`] : [`'self'`, `'unsafe-inline'`]

  const directives: Record<string, string[]> = {
    'default-src': [`'self'`],
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'style-src-elem': styleSrc,
    // style="" attributes rendered by React on the server (e.g. CSS variables). They cannot
    // run code; <style> elements and scripts stay nonce-only. Older browsers without
    // style-src-attr fall back to style-src (attributes blocked, page still works).
    'style-src-attr': [`'unsafe-inline'`],
    'img-src': [`'self'`, 'data:', 'blob:', ...THIRD_PARTY.img],
    'font-src': [`'self'`],
    'connect-src': [`'self'`, ...THIRD_PARTY.connect, ...(isDev ? ['ws:'] : [])],
    'frame-src': THIRD_PARTY.frame.length ? THIRD_PARTY.frame : [`'none'`],
    'object-src': [`'none'`],
    'base-uri': [`'self'`],
    'form-action': [`'self'`],
    'frame-ancestors': [`'none'`],
    'manifest-src': [`'self'`],
    'worker-src': [`'self'`, 'blob:'],
  }

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')

  // Upgrading only makes sense when the site is served over https.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`
}

export type HeaderPair = { key: string; value: string }

/** Headers sent on every response, regardless of rendering mode. */
export function baseSecurityHeaders({
  isDev,
  referrerPolicy = 'strict-origin-when-cross-origin',
}: {
  isDev: boolean
  referrerPolicy?: string
}): HeaderPair[] {
  const headers: HeaderPair[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: referrerPolicy },
    {
      key: 'Permissions-Policy',
      value:
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ]
  if (!isDev) {
    // Two years. "preload" is added only after go-live (see docs/go-live-checklist.md).
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' })
  }
  return headers
}

/** Paths that are rendered per request and protected with a nonce-based CSP. */
export const NONCE_PATH_PREFIXES = ['/agendar', '/admin', '/a/'] as const

/** Paths that must never be indexed (private areas and links carrying tokens). */
export const NOINDEX_PATH_PREFIXES = ['/admin', '/agendar/minha-agenda', '/a/'] as const

/** Paths whose URL may carry a secret token: never leak it through the Referer header. */
export const NO_REFERRER_PATH_PREFIXES = ['/a/'] as const

export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) =>
    prefix.endsWith('/')
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
