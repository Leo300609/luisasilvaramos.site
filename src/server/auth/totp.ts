/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226), the codes shown by
 * Google Authenticator, Authy, 1Password and similar apps. SHA-1, 6 digits,
 * 30-second steps: the only combination every app supports.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) throw new Error('invalid base32')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export const STEP_SECONDS = 30
export const DIGITS = 6

/** 160-bit secret, base32 (what the app's QR code carries). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', secret).update(msg).digest()
  const offset = mac[mac.length - 1]! & 0xf
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return String(code).padStart(digits, '0')
}

export const stepAt = (now: Date) => Math.floor(now.getTime() / 1000 / STEP_SECONDS)

/**
 * Checks a code against the current step ±1 (clock drift). Returns the matched
 * step, or null. Steps ≤ `lastStep` are refused, so a code cannot be replayed.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  now: Date,
  lastStep: number | null = null,
): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const secret = base32Decode(secretBase32)
  const current = stepAt(now)
  let matched: number | null = null
  for (const step of [current - 1, current, current + 1]) {
    const expected = Buffer.from(hotp(secret, step))
    // Compare every candidate (constant work), keep the match.
    if (timingSafeEqual(expected, Buffer.from(code)) && (lastStep === null || step > lastStep)) {
      matched = step
    }
  }
  return matched
}

/** otpauth:// URI for the QR code (Key Uri Format). */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
