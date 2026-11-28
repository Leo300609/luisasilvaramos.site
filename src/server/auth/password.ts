/**
 * Password hashing with scrypt (Node's built-in crypto; no native module to
 * bundle on Netlify). Parameters follow OWASP's Password Storage Cheat Sheet:
 * N=2^17, r=8, p=1. The stored string carries its parameters, so they can be
 * raised later and old hashes upgraded on the next successful login.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const scryptAsync = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  )

export const SCRYPT = { logN: 17, r: 8, p: 1, keylen: 32 } as const
type Params = { logN: number; r: number; p: number; keylen: number }

async function derive(password: string, salt: Buffer, params: Params): Promise<Buffer> {
  const N = 2 ** params.logN
  return scryptAsync(password.normalize('NFKC'), salt, params.keylen, {
    N,
    r: params.r,
    p: params.p,
    // scrypt needs 128·N·r bytes; leave headroom.
    maxmem: 256 * N * params.r,
  })
}

const b64 = (buf: Buffer) => buf.toString('base64url')

export async function hashPassword(password: string, params: Params = SCRYPT): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, params)
  return ['scrypt', params.logN, params.r, params.p, b64(salt), b64(key)].join('$')
}

function parse(stored: string) {
  const [alg, logN, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !logN || !r || !p || !salt || !key) return null
  const keyBuf = Buffer.from(key, 'base64url')
  return {
    params: { logN: Number(logN), r: Number(r), p: Number(p), keylen: keyBuf.length },
    salt: Buffer.from(salt, 'base64url'),
    key: keyBuf,
  }
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored)
  if (!parsed) return false
  const key = await derive(password, parsed.salt, parsed.params)
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key)
}

/** True when the hash uses weaker parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const parsed = parse(stored)
  return !parsed || parsed.params.logN < SCRYPT.logN || parsed.params.r < SCRYPT.r
}

/**
 * A valid hash of a random password: lets a login for an unknown e-mail take
 * the same time as a real one (no account enumeration by timing).
 */
let dummy: Promise<string> | undefined
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'))
  return dummy
}

export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128

/** NIST SP 800-63B: length over composition rules; refuse the obvious. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`
  if (password.length > PASSWORD_MAX) return `Use no máximo ${PASSWORD_MAX} caracteres.`
  const lower = password.toLowerCase()
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  if (local.length >= 4 && lower.includes(local)) return 'A senha não pode conter o seu e-mail.'
  if (/^(.)\1+$/.test(password)) return 'Escolha uma senha menos previsível.'
  const common = ['123456789012', 'senha1234567', 'password1234', 'luisaramos12', 'maquiagem123']
  if (common.some((c) => lower.startsWith(c))) return 'Essa senha é muito comum.'
  return null
}
