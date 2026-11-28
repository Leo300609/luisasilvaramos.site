/**
 * Single-use recovery codes, for when the phone with the authenticator app is
 * lost. Shown once; only their SHA-256 is stored. 10 codes × 50 bits each.
 */
import { createHash, randomBytes } from 'node:crypto'

import { base32Encode } from './totp'

export const RECOVERY_CODE_COUNT = 10

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toLowerCase()
}

export const hashRecoveryCode = (code: string) =>
  createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex')

/** "abcde-fghij" (base32, no ambiguous casing). */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase()
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}

export const looksLikeRecoveryCode = (code: string) =>
  /^[a-z2-7]{10}$/.test(normalizeRecoveryCode(code))
