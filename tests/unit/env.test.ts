import { describe, expect, it } from 'vitest'

import { parseServerEnv } from '@/env/schema'

describe('parseServerEnv', () => {
  it('uses safe local defaults', () => {
    const env = parseServerEnv({ NODE_ENV: 'development' })
    expect(env.APP_ENV).toBe('local')
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000')
    expect(env.SITE_INDEXABLE).toBe(false)
    expect(env.LOG_LEVEL).toBe('info')
  })

  it('derives production settings from Netlify variables', () => {
    const env = parseServerEnv({
      NODE_ENV: 'production',
      CONTEXT: 'production',
      URL: 'https://luisasilvaramos.com.br',
    })
    expect(env.APP_ENV).toBe('production')
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://luisasilvaramos.com.br')
  })

  it('derives preview settings from Netlify deploy previews', () => {
    const env = parseServerEnv({
      NODE_ENV: 'production',
      CONTEXT: 'deploy-preview',
      DEPLOY_PRIME_URL: 'https://deploy-preview-3--site.netlify.app',
    })
    expect(env.APP_ENV).toBe('preview')
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://deploy-preview-3--site.netlify.app')
  })

  it('treats blank optional values as missing', () => {
    expect(parseServerEnv({ NODE_ENV: 'development', COMMIT_REF: '' }).COMMIT_REF).toBeUndefined()
  })

  it('refuses http in production', () => {
    expect(() =>
      parseServerEnv({ APP_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://example.com' }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL: must use https/)
  })

  it('refuses indexing outside production', () => {
    expect(() =>
      parseServerEnv({
        APP_ENV: 'preview',
        SITE_INDEXABLE: 'true',
        NEXT_PUBLIC_SITE_URL: 'https://x.netlify.app',
      }),
    ).toThrow(/SITE_INDEXABLE/)
  })

  it('fails fast without leaking values', () => {
    try {
      parseServerEnv({ APP_ENV: 'nope', LOG_LEVEL: 'super-secret-value' })
      expect.unreachable()
    } catch (error) {
      const message = (error as Error).message
      expect(message).toMatch(/APP_ENV/)
      expect(message).toMatch(/LOG_LEVEL/)
      expect(message).not.toContain('super-secret-value')
    }
  })
})

describe('e-mail variables', () => {
  it('requires EMAIL_FROM with a Resend key', () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: 'development', RESEND_API_KEY: 're_abcdefghijklmnop' }),
    ).toThrow(/EMAIL_FROM/)
  })

  it('accepts a complete configuration', () => {
    const env = parseServerEnv({
      NODE_ENV: 'development',
      RESEND_API_KEY: 're_abcdefghijklmnop',
      EMAIL_FROM: 'Luísa Silva Ramos <agenda@luisasilvaramos.com.br>',
      EMAIL_ADMIN_NOTIFY: 'luisa@exemplo.com',
    })
    expect(env.EMAIL_ADMIN_NOTIFY).toBe('luisa@exemplo.com')
  })

  it('rejects a malformed sender', () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: 'development', EMAIL_FROM: 'agenda@luisasilvaramos.com.br' }),
    ).toThrow(/EMAIL_FROM/)
  })
})
