import { describe, expect, it } from 'vitest'

import { hashPassword, needsRehash, passwordProblem, verifyPassword } from '@/server/auth/password'
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
} from '@/server/auth/recovery'
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  stepAt,
  verifyTotp,
} from '@/server/auth/totp'

// RFC 4226 appendix D / RFC 6238 appendix B (SHA-1 seed "12345678901234567890").
const RFC_SECRET = Buffer.from('12345678901234567890')

describe('HOTP / TOTP', () => {
  it('matches the RFC 4226 test vectors', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676']
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code))
  })

  it('matches the RFC 6238 test vectors (truncated to 6 digits)', () => {
    const vectors: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ]
    for (const [seconds, code] of vectors) {
      expect(hotp(RFC_SECRET, stepAt(new Date(seconds * 1000)), 8)).toBe(code)
    }
  })

  it('round-trips base32', () => {
    expect(base32Encode(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(base32Decode('gezd gnbv-gy3tqojqgezdgnbvgy3tqojq')).toEqual(RFC_SECRET)
  })

  it('accepts the current code and ±1 step, refuses replays and others', () => {
    const secret = generateTotpSecret()
    const now = new Date('2026-12-01T12:00:10Z')
    const raw = base32Decode(secret)
    const step = stepAt(now)
    expect(verifyTotp(secret, hotp(raw, step), now)).toBe(step)
    expect(verifyTotp(secret, hotp(raw, step - 1), now)).toBe(step - 1)
    expect(verifyTotp(secret, hotp(raw, step + 1), now)).toBe(step + 1)
    expect(verifyTotp(secret, hotp(raw, step - 2), now)).toBeNull()
    expect(verifyTotp(secret, hotp(raw, step), now, step)).toBeNull() // replay
    expect(verifyTotp(secret, '12345', now)).toBeNull()
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull()
  })

  it('builds an otpauth URI the apps understand', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'luisa@exemplo.com', 'Luísa Silva Ramos')
    expect(uri).toMatch(/^otpauth:\/\/totp\/Lu%C3%ADsa%20Silva%20Ramos%3Aluisa%40exemplo\.com\?/)
    expect(new URL(uri).searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP')
  })
})

describe('passwords', () => {
  // Low cost keeps the unit suite fast; the format records the parameters.
  const cheap = { logN: 10, r: 8, p: 1, keylen: 32 }

  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('uma senha bem comprida', cheap)
    const b = await hashPassword('uma senha bem comprida', cheap)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^scrypt\$10\$8\$1\$/)
    await expect(verifyPassword('uma senha bem comprida', a)).resolves.toBe(true)
    await expect(verifyPassword('uma senha bem comprid', a)).resolves.toBe(false)
    await expect(verifyPassword('x', 'garbage')).resolves.toBe(false)
  })

  it('flags weaker parameters for an upgrade', async () => {
    expect(needsRehash(await hashPassword('uma senha bem comprida', cheap))).toBe(true)
  })

  it('applies the length-first policy', () => {
    expect(passwordProblem('curta', 'a@b.com')).toMatch(/12/)
    expect(passwordProblem('luisa.silva.2026!', 'luisa.silva@x.com')).toMatch(/e-mail/)
    expect(passwordProblem('aaaaaaaaaaaaaa', 'a@b.com')).toMatch(/previsível/)
    expect(passwordProblem('café com pão e batom', 'luisa@x.com')).toBeNull()
  })
})

describe('recovery codes', () => {
  it('are unique, readable and hashed after normalisation', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/)
    expect(hashRecoveryCode(codes[0]!.toUpperCase().replace('-', ' '))).toBe(
      hashRecoveryCode(codes[0]!),
    )
    expect(looksLikeRecoveryCode(codes[0]!)).toBe(true)
    expect(looksLikeRecoveryCode('123456')).toBe(false)
  })
})
