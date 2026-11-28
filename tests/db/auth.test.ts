import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { confirmBooking, declineBooking, listBookings } from '@/server/admin/bookings'
import {
  beginTotpEnrollment,
  changePassword,
  checkSession,
  confirmTotpEnrollment,
  createAdminUser,
  loginWithPassword,
  POLICY,
  requestPasswordReset,
  issuePasswordResetToken,
  resetPassword,
  resetTwoFactor,
  revokeAllSessions,
  verifySecondFactor,
  type AuthDeps,
} from '@/server/auth/service'
import { base32Decode, hotp, stepAt } from '@/server/auth/totp'
import { createBooking } from '@/server/booking/create'
import * as schema from '@/server/db/schema'
import { MemoryMailer } from '@/server/email/mailer'
import { deliverDueEmails } from '@/server/email/outbox'
import { addMinutes } from '@/server/scheduling/time'

import { bookingInput, keyRing, NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())

const EMAIL = 'luisa@exemplo.com'
const PASSWORD = 'café com pão e batom'
const SECRET = 'test-auth-secret-0123456789abcdefghij'
const client = { ip: '203.0.113.7', userAgent: 'vitest' }
const deps = (now = NOW): AuthDeps => ({ now, keyRing, secret: SECRET })

let userId = ''
beforeEach(async () => {
  await resetData(db)
  userId = await createAdminUser(
    db,
    { email: EMAIL, name: 'Luísa Silva Ramos', password: PASSWORD },
    NOW,
  )
})

const codeFor = (secret: string, now: Date, offset = 0) =>
  hotp(base32Decode(secret), stepAt(now) + offset)

/** Logs in and finishes the 2FA setup; returns the TOTP secret and a full session token. */
async function enrolled(now = NOW) {
  const step1 = await loginWithPassword(
    db,
    { email: EMAIL, password: PASSWORD, remember: false },
    client,
    deps(now),
  )
  if (step1.kind !== 'ok') throw new Error('login failed')
  const setup = await beginTotpEnrollment(db, step1.token, deps(now))
  const done = await confirmTotpEnrollment(
    db,
    step1.token,
    codeFor(setup!.secret, now),
    client,
    deps(now),
  )
  if (done.kind !== 'ok') throw new Error('enroll failed')
  return { secret: setup!.secret, token: done.token, recoveryCodes: done.recoveryCodes }
}

describe('password step', () => {
  it('accepts the right password with any e-mail casing and asks for the 2FA setup', async () => {
    const r = await loginWithPassword(
      db,
      { email: ' LUISA@exemplo.com ', password: PASSWORD, remember: false },
      client,
      deps(),
    )
    expect(r).toMatchObject({ kind: 'ok', needsEnrollment: true })
    if (r.kind !== 'ok') return
    // The pending session cannot be used as a full one.
    await expect(checkSession(db, r.token, NOW)).resolves.toMatchObject({ status: 'pending' })
  })

  it('gives the same answer for a wrong password and an unknown e-mail', async () => {
    const wrong = await loginWithPassword(
      db,
      { email: EMAIL, password: 'errada errada', remember: false },
      client,
      deps(),
    )
    const unknown = await loginWithPassword(
      db,
      { email: 'x@exemplo.com', password: PASSWORD, remember: false },
      client,
      deps(),
    )
    expect(wrong).toEqual({ kind: 'invalid' })
    expect(unknown).toEqual({ kind: 'invalid' })
  })

  it('locks the account after 5 failures for 5 minutes, even with the right password', async () => {
    for (let i = 0; i < POLICY.maxFailuresPerAccount; i++) {
      await loginWithPassword(
        db,
        { email: EMAIL, password: `errada ${i}`, remember: false },
        client,
        deps(),
      )
    }
    const blocked = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(),
    )
    expect(blocked).toEqual({ kind: 'locked' })
    const later = addMinutes(NOW, POLICY.lockWindowMin + 1)
    await expect(
      loginWithPassword(
        db,
        { email: EMAIL, password: PASSWORD, remember: false },
        client,
        deps(later),
      ),
    ).resolves.toMatchObject({ kind: 'ok' })
  })

  it('audits without personal data', async () => {
    await loginWithPassword(
      db,
      { email: EMAIL, password: 'errada errada', remember: false },
      client,
      deps(),
    )
    const rows = await db.select().from(schema.auditLog)
    expect(rows[0]).toMatchObject({ action: 'login.failed', actorId: userId })
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7')
    expect(JSON.stringify(await db.select().from(schema.authAttempts))).not.toContain(EMAIL)
  })
})

describe('second factor', () => {
  it('enrolment shows a secret, confirms with a code and returns 10 recovery codes', async () => {
    const { token, recoveryCodes } = await enrolled()
    expect(recoveryCodes).toHaveLength(10)
    await expect(checkSession(db, token, NOW)).resolves.toMatchObject({ status: 'valid' })
    const [user] = await db.select().from(schema.adminUsers)
    expect(user!.totpSecretEnc).not.toMatch(/^[A-Z2-7]{32}$/) // encrypted at rest
    expect(user!.recoveryCodeHashes).toHaveLength(10)
  })

  it('logs in with password + code, rotating the session token', async () => {
    const { secret } = await enrolled()
    const later = addMinutes(NOW, 5)
    const step1 = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: true },
      client,
      deps(later),
    )
    expect(step1).toMatchObject({ kind: 'ok', needsEnrollment: false })
    if (step1.kind !== 'ok') return
    const r = await verifySecondFactor(db, step1.token, codeFor(secret, later), client, deps(later))
    expect(r).toMatchObject({ kind: 'ok', remember: true })
    if (r.kind !== 'ok') return
    expect(r.token).not.toBe(step1.token)
    await expect(checkSession(db, step1.token, later)).resolves.toEqual({ status: 'expired' })
  })

  it('refuses a replayed code', async () => {
    const { secret } = await enrolled()
    const later = addMinutes(NOW, 1)
    const code = codeFor(secret, later)
    const a = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(later),
    )
    const b = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(later),
    )
    if (a.kind !== 'ok' || b.kind !== 'ok') throw new Error('login failed')
    await expect(verifySecondFactor(db, a.token, code, client, deps(later))).resolves.toMatchObject(
      { kind: 'ok' },
    )
    await expect(verifySecondFactor(db, b.token, code, client, deps(later))).resolves.toMatchObject(
      { kind: 'invalid' },
    )
  })

  it('accepts each recovery code once', async () => {
    const { recoveryCodes } = await enrolled()
    const login = async () => {
      const r = await loginWithPassword(
        db,
        { email: EMAIL, password: PASSWORD, remember: false },
        client,
        deps(),
      )
      if (r.kind !== 'ok') throw new Error('login failed')
      return r.token
    }
    const code = recoveryCodes[3]!.toUpperCase()
    await expect(
      verifySecondFactor(db, await login(), code, client, deps()),
    ).resolves.toMatchObject({ kind: 'ok' })
    await expect(
      verifySecondFactor(db, await login(), code, client, deps()),
    ).resolves.toMatchObject({ kind: 'invalid' })
    const [user] = await db.select().from(schema.adminUsers)
    expect(user!.recoveryCodeHashes).toHaveLength(9)
  })

  it('drops the pending session after 5 wrong codes', async () => {
    await enrolled()
    const step1 = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(),
    )
    if (step1.kind !== 'ok') throw new Error('login failed')
    let last
    for (let i = 0; i < POLICY.maxMfaFailures; i++) {
      last = await verifySecondFactor(db, step1.token, '000000', client, deps())
    }
    expect(last).toEqual({ kind: 'locked' })
    await expect(checkSession(db, step1.token, NOW)).resolves.toEqual({ status: 'expired' })
  })

  it('a pending session expires after 10 minutes', async () => {
    const step1 = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(),
    )
    if (step1.kind !== 'ok') throw new Error('login failed')
    await expect(checkSession(db, step1.token, addMinutes(NOW, 11))).resolves.toEqual({
      status: 'expired',
    })
  })
})

describe('sessions', () => {
  it('expire after 2 h idle without "manter conectada"', async () => {
    const { token } = await enrolled()
    await expect(checkSession(db, token, addMinutes(NOW, 100))).resolves.toMatchObject({
      status: 'valid',
    })
    await expect(checkSession(db, token, addMinutes(NOW, 100 + 121))).resolves.toEqual({
      status: 'expired',
    })
  })

  it('"sair de todos os dispositivos" revokes every session', async () => {
    const { token } = await enrolled()
    await revokeAllSessions(db, userId, NOW)
    await expect(checkSession(db, token, NOW)).resolves.toEqual({ status: 'expired' })
  })

  it('emergency 2FA reset signs out and forces a new setup', async () => {
    const { token } = await enrolled()
    await expect(resetTwoFactor(db, EMAIL, NOW)).resolves.toBe(true)
    await expect(checkSession(db, token, NOW)).resolves.toEqual({ status: 'expired' })
    const r = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(),
    )
    expect(r).toMatchObject({ kind: 'ok', needsEnrollment: true })
  })
})

describe('password reset', () => {
  it('e-mails a one-time link (queued only for real admins) and signs out everywhere', async () => {
    const { token: session } = await enrolled()
    await expect(requestPasswordReset(db, 'ninguem@exemplo.com', client, deps())).resolves.toBe(
      false,
    )
    await expect(requestPasswordReset(db, EMAIL, client, deps())).resolves.toBe(true)

    const mailer = new MemoryMailer()
    await deliverDueEmails(db, {
      mailer,
      keyRing,
      siteUrl: 'https://site.test',
      adminEmail: null,
      now: NOW,
    })
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0]!.to).toBe(EMAIL)
    const token = /\/admin\/r\/([A-Za-z0-9_-]{43})/.exec(mailer.sent[0]!.text)![1]!

    await expect(resetPassword(db, token, 'curta', client, deps())).resolves.toMatchObject({
      kind: 'weak',
    })
    await expect(
      resetPassword(db, token, 'uma senha nova e longa', client, deps()),
    ).resolves.toEqual({ kind: 'ok' })
    await expect(
      resetPassword(db, token, 'outra senha nova longa', client, deps()),
    ).resolves.toEqual({ kind: 'invalid-token' })
    await expect(checkSession(db, session, NOW)).resolves.toEqual({ status: 'expired' })
    await expect(
      loginWithPassword(
        db,
        { email: EMAIL, password: 'uma senha nova e longa', remember: false },
        client,
        deps(),
      ),
    ).resolves.toMatchObject({ kind: 'ok', needsEnrollment: false })
  })

  it('reset links expire after 30 minutes', async () => {
    const token = await issuePasswordResetToken(db, userId, NOW)
    await expect(
      resetPassword(db, token, 'uma senha nova e longa', client, deps(addMinutes(NOW, 31))),
    ).resolves.toEqual({ kind: 'invalid-token' })
  })

  it('throttles reset requests to 3 per hour', async () => {
    const results = []
    for (let i = 0; i < 4; i++) results.push(await requestPasswordReset(db, EMAIL, client, deps()))
    expect(results).toEqual([true, true, true, false])
  })
})

describe('panel actions on bookings', () => {
  it('confirms a pending booking, e-mails the client and audits', async () => {
    const input = bookingInput()
    const { id } = await createBooking(db, input, { now: NOW, keyRing })
    await confirmBooking(db, id, { now: NOW, actorId: userId, secret: SECRET })
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b).toMatchObject({ status: 'confirmado', expiresAt: null })
    await expect(
      confirmBooking(db, id, { now: NOW, actorId: userId, secret: SECRET }),
    ).rejects.toThrow(/não está mais pendente/)
    const mailer = new MemoryMailer()
    await deliverDueEmails(db, {
      mailer,
      keyRing,
      siteUrl: 'https://site.test',
      adminEmail: null,
      now: NOW,
    })
    expect(mailer.sent.map((m) => m.subject)).toContainEqual(
      expect.stringMatching(/^Agendamento confirmado/),
    )
    const audits = await db.select().from(schema.auditLog)
    expect(audits).toContainEqual(
      expect.objectContaining({ action: 'booking.confirmed', targetId: id }),
    )
  })

  it('declines a pending booking, frees the slot and tells the client', async () => {
    const { id } = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await declineBooking(db, id, { now: NOW, actorId: userId, secret: SECRET })
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id))
    expect(b).toMatchObject({ status: 'cancelado', cancelReason: 'recusado' })
    await expect(
      createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing }),
    ).resolves.toBeTruthy()
    const mailer = new MemoryMailer()
    await deliverDueEmails(db, {
      mailer,
      keyRing,
      siteUrl: 'https://site.test',
      adminEmail: null,
      now: NOW,
    })
    expect(mailer.sent.map((m) => m.subject)).toContainEqual(
      expect.stringMatching(/^Não foi possível confirmar/),
    )
  })

  it('lists pending first and finds by name or code', async () => {
    const a = await createBooking(db, bookingInput({ time: '09:00' }), { now: NOW, keyRing })
    await createBooking(db, bookingInput({ time: '14:00' }), { now: NOW, keyRing })
    await confirmBooking(db, a.id, { now: NOW, actorId: userId, secret: SECRET })
    const all = await listBookings(db, { status: 'todos', page: 1 })
    expect(all.total).toBe(2)
    expect(all.rows[0]!.status).toBe('pendente')
    await expect(listBookings(db, { status: 'todos', q: 'lsr-1', page: 1 })).resolves.toMatchObject(
      { total: 1 },
    )
    await expect(listBookings(db, { status: 'pendente', page: 1 })).resolves.toMatchObject({
      total: 1,
    })
    await expect(listBookings(db, { status: 'todos', q: '100%_', page: 1 })).resolves.toMatchObject(
      { total: 0 },
    )
  })
})

describe('change password (panel)', () => {
  it('needs the current password, applies the policy and signs out the other devices', async () => {
    const a = await enrolled()
    const later = addMinutes(NOW, 2)
    const step1 = await loginWithPassword(
      db,
      { email: EMAIL, password: PASSWORD, remember: false },
      client,
      deps(later),
    )
    if (step1.kind !== 'ok') throw new Error('login failed')
    const b = await verifySecondFactor(
      db,
      step1.token,
      codeFor(a.secret, later),
      client,
      deps(later),
    )
    if (b.kind !== 'ok') throw new Error('mfa failed')
    const sessionA = (await checkSession(db, a.token, NOW)) as { session: { id: string } }
    const base = { userId, sessionId: sessionA.session.id }
    await expect(
      changePassword(
        db,
        { ...base, current: 'errada', next: 'uma senha nova e longa' },
        client,
        deps(),
      ),
    ).resolves.toEqual({ kind: 'wrong-password' })
    await expect(
      changePassword(db, { ...base, current: PASSWORD, next: 'curta' }, client, deps()),
    ).resolves.toMatchObject({ kind: 'weak' })
    await expect(
      changePassword(
        db,
        { ...base, current: PASSWORD, next: 'uma senha nova e longa' },
        client,
        deps(),
      ),
    ).resolves.toEqual({ kind: 'ok' })
    await expect(checkSession(db, a.token, NOW)).resolves.toMatchObject({ status: 'valid' })
    await expect(checkSession(db, b.token, addMinutes(NOW, 1))).resolves.toEqual({
      status: 'expired',
    })
    await expect(
      loginWithPassword(
        db,
        { email: EMAIL, password: 'uma senha nova e longa', remember: false },
        client,
        deps(addMinutes(NOW, 2)),
      ),
    ).resolves.toMatchObject({ kind: 'ok' })
  })
})
