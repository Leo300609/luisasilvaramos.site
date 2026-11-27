import { describe, expect, it } from 'vitest'

import {
  decryptField,
  encryptField,
  generateKey,
  needsRotation,
  parseKeyRing,
} from '@/server/crypto/fields'

const k1 = generateKey()
const k2 = generateKey()

describe('field encryption', () => {
  const ring = parseKeyRing(`v1:${k1}`, 'v1')

  it('round-trips unicode text and never stores plaintext', () => {
    const secret = 'Rua das Flores, 123 · alergia a látex'
    const stored = encryptField(secret, ring)
    expect(stored.startsWith('v1:')).toBe(true)
    expect(stored).not.toContain('Flores')
    expect(decryptField(stored, ring)).toBe(secret)
  })

  it('uses a fresh IV every time', () => {
    expect(encryptField('x', ring)).not.toBe(encryptField('x', ring))
  })

  it('detects tampering', () => {
    const stored = encryptField('valor', ring).split(':')
    stored[2] = Buffer.from('outro').toString('base64url')
    expect(() => decryptField(stored.join(':'), ring)).toThrow()
  })

  it('binds ciphertext to its context (AAD)', () => {
    const stored = encryptField('endereço', ring, 'booking:1')
    expect(decryptField(stored, ring, 'booking:1')).toBe('endereço')
    expect(() => decryptField(stored, ring, 'booking:2')).toThrow()
  })

  it('supports key rotation: old values still decrypt, new ones use the active key', () => {
    const old = encryptField('antigo', ring)
    const rotated = parseKeyRing(`v1:${k1},v2:${k2}`, 'v2')
    expect(decryptField(old, rotated)).toBe('antigo')
    expect(needsRotation(old, rotated)).toBe(true)
    expect(encryptField('novo', rotated).startsWith('v2:')).toBe(true)
  })

  it('fails fast on bad configuration', () => {
    expect(() => parseKeyRing(undefined, 'v1')).toThrow()
    expect(() => parseKeyRing(`v1:${k1}`, 'v9')).toThrow()
    expect(() => parseKeyRing('v1:c2hvcnQ=', 'v1')).toThrow(/32 bytes/)
  })
})
