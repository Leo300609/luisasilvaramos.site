import { describe, expect, it } from 'vitest'

import {
  NOINDEX_PATH_PREFIXES,
  NONCE_PATH_PREFIXES,
  baseSecurityHeaders,
  buildCsp,
  matchesPrefix,
} from '@/lib/security/headers'

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)

describe('buildCsp', () => {
  it('uses nonce + strict-dynamic and no unsafe-inline scripts on dynamic pages', () => {
    const csp = buildCsp({ nonce: 'abc123', isDev: false })
    expect(directive(csp, 'script-src')).toBe(`'self' 'nonce-abc123' 'strict-dynamic'`)
    expect(directive(csp, 'style-src')).toBe(`'self' 'nonce-abc123'`)
    expect(csp).not.toContain('unsafe-eval')
  })

  it('locks down framing, plugins, base and forms', () => {
    const csp = buildCsp({ isDev: false })
    expect(directive(csp, 'frame-ancestors')).toBe(`'none'`)
    expect(directive(csp, 'object-src')).toBe(`'none'`)
    expect(directive(csp, 'base-uri')).toBe(`'self'`)
    expect(directive(csp, 'form-action')).toBe(`'self'`)
    expect(csp).toContain('upgrade-insecure-requests')
  })

  it('only allows eval in development', () => {
    expect(buildCsp({ isDev: true })).toContain(`'unsafe-eval'`)
    expect(buildCsp({ isDev: false })).not.toContain(`'unsafe-eval'`)
  })
})

describe('baseSecurityHeaders', () => {
  it('sends HSTS only outside development', () => {
    const keys = (isDev: boolean) => baseSecurityHeaders({ isDev }).map((h) => h.key)
    expect(keys(false)).toContain('Strict-Transport-Security')
    expect(keys(true)).not.toContain('Strict-Transport-Security')
    expect(keys(false)).toEqual(
      expect.arrayContaining(['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']),
    )
  })
})

describe('matchesPrefix', () => {
  it.each([
    ['/admin', true],
    ['/admin/agenda', true],
    ['/administrativo', false],
    ['/agendar', true],
    ['/agendar/minha-agenda', true],
    ['/a/TOKEN', true],
    ['/about', false],
    ['/', false],
  ])('nonce paths: %s → %s', (path, expected) => {
    expect(matchesPrefix(path, NONCE_PATH_PREFIXES)).toBe(expected)
  })

  it('keeps the public booking page indexable but not "minha agenda"', () => {
    expect(matchesPrefix('/agendar', NOINDEX_PATH_PREFIXES)).toBe(false)
    expect(matchesPrefix('/agendar/minha-agenda', NOINDEX_PATH_PREFIXES)).toBe(true)
  })
})
