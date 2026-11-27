/**
 * Application-level encryption for sensitive columns (address, notes, allergies,
 * CPF, TOTP secrets). AES-256-GCM, random 96-bit IV, versioned keys so keys can
 * be rotated without downtime (docs/adr/0009-cifragem-campos.md).
 *
 * Stored format: "v1:<iv b64url>:<ciphertext b64url>:<tag b64url>"
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type KeyRing = { active: string; keys: Map<string, Buffer> }

export function parseKeyRing(encKeys: string | undefined, active: string | undefined): KeyRing {
  if (!encKeys || !active) {
    throw new Error('ENC_KEYS and ENC_ACTIVE_KEY must be configured to store sensitive data.')
  }
  const keys = new Map<string, Buffer>()
  for (const entry of encKeys.split(',')) {
    const [version, material] = entry.split(':')
    if (!version || !material) throw new Error('Malformed ENC_KEYS entry')
    const key = Buffer.from(material, 'base64')
    if (key.length !== 32) throw new Error(`Key ${version} must be 32 bytes`)
    keys.set(version, key)
  }
  if (!keys.has(active)) throw new Error('ENC_ACTIVE_KEY is not in ENC_KEYS')
  return { active, keys }
}

const b64 = (buf: Buffer) => buf.toString('base64url')

export function encryptField(plain: string, ring: KeyRing, aad = ''): string {
  const key = ring.keys.get(ring.active)
  if (!key) throw new Error('Active key missing')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  if (aad) cipher.setAAD(Buffer.from(aad))
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [ring.active, b64(iv), b64(ciphertext), b64(cipher.getAuthTag())].join(':')
}

export function decryptField(stored: string, ring: KeyRing, aad = ''): string {
  const [version, iv, ciphertext, tag] = stored.split(':')
  if (!version || !iv || ciphertext === undefined || !tag) throw new Error('Malformed ciphertext')
  const key = ring.keys.get(version)
  if (!key) throw new Error(`Unknown key version ${version}`)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  if (aad) decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/** True when the value was encrypted with an older key and should be re-encrypted. */
export function needsRotation(stored: string, ring: KeyRing): boolean {
  return !stored.startsWith(`${ring.active}:`)
}

/** Generates a key for ENC_KEYS: `npx tsx -e "…generateKey()"` or `openssl rand -base64 32`. */
export function generateKey(): string {
  return randomBytes(32).toString('base64')
}
