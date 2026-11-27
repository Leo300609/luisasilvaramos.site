import { describe, expect, it } from 'vitest'

import { whatsappLink } from '@/lib/contact'

describe('whatsappLink', () => {
  it('builds a wa.me link with an encoded message', () => {
    expect(whatsappLink('Olá & tudo bem? #1')).toBe(
      'https://wa.me/5511930546322?text=Ol%C3%A1%20%26%20tudo%20bem%3F%20%231',
    )
  })

  it('cannot be broken by user content', () => {
    const url = new URL(whatsappLink('a"><script>&phone=000'))
    expect(url.hostname).toBe('wa.me')
    expect(url.searchParams.get('phone')).toBeNull()
    expect(url.searchParams.get('text')).toBe('a"><script>&phone=000')
  })

  it('rejects malformed phone numbers', () => {
    expect(() => whatsappLink('oi', '+55 11 9')).toThrow()
  })
})
