/**
 * Admin authentication (docs/adr/0005-auth-admin.md).
 *
 * Login is two steps: password, then the second factor (TOTP or a recovery
 * code). The first step only yields a short "pending" session that can do
 * nothing but finish the second step (or the 2FA setup on first login).
 *
 * Sessions live in the database (revocable, "sair de todos os dispositivos");
 * the cookie holds a 256-bit random token and the table only its SHA-256.
 */
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm'

import { generateToken, hashToken } from '../booking/tokens'
import { decryptField, encryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { enqueueEmail } from '../email/enqueue'
import type { Db } from '../scheduling/context'
import { addMinutes } from '../scheduling/time'
import { audit, hashIdentifier } from './audit'
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from './password'
import { generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode } from './recovery'
import { generateTotpSecret, verifyTotp } from './totp'

export const POLICY = {
  /** Password step, per e-mail: N failures inside the window lock it for the window. */
  maxFailuresPerAccount: 5,
  /** Per IP (several accounts tried from one place). */
  maxFailuresPerIp: 20,
  lockWindowMin: 5,
  ipWindowMin: 15,
  /** Second factor: failures per user before the pending session is dropped. */
  maxMfaFailures: 5,
  pendingSessionMin: 10,
  /** Without "manter conectada": absolute limit and idle limit. */
  sessionHours: 12,
  idleHours: 2,
  /** With "manter conectada": sliding 30 days. */
  rememberDays: 30,
  lastSeenEveryMin: 5,
  resetTokenMin: 30,
} as const

export type AuthDeps = { now: Date; keyRing: KeyRing; secret: string }
export type ClientInfo = { ip?: string | null; userAgent?: string | null }

const TOTP_AAD = 'admin_users.totp_secret'

// ── Attempts and lockout ─────────────────────────────────────────────────────

const key = (kind: string, value: string, secret: string) =>
  `${kind}:${hashIdentifier(value.toLowerCase(), secret)}`

async function failuresSince(db: Db, k: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.authAttempts)
    .where(
      and(
        eq(schema.authAttempts.key, k),
        eq(schema.authAttempts.success, false),
        gt(schema.authAttempts.createdAt, since),
      ),
    )
  return row?.n ?? 0
}

async function record(db: Db, keys: string[], success: boolean, now: Date) {
  if (keys.length === 0) return
  await db
    .insert(schema.authAttempts)
    .values(keys.map((k) => ({ key: k, success, createdAt: now })))
}

/** A success clears the account's counter (the IP counter keeps its history). */
async function clearFailures(db: Db, k: string, now: Date) {
  await db
    .delete(schema.authAttempts)
    .where(and(eq(schema.authAttempts.key, k), eq(schema.authAttempts.success, false)))
  void now
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export type Session = {
  id: string
  userId: string
  mfaVerified: boolean
  remember: boolean
  expiresAt: Date
}

async function createSession(
  db: Db,
  userId: string,
  opts: { remember: boolean; mfaVerified: boolean; now: Date; userAgent?: string | null },
): Promise<{ token: string; session: Session }> {
  const token = generateToken()
  const expiresAt = opts.mfaVerified
    ? addMinutes(opts.now, opts.remember ? POLICY.rememberDays * 24 * 60 : POLICY.sessionHours * 60)
    : addMinutes(opts.now, POLICY.pendingSessionMin)
  const id = hashToken(token)
  await db.insert(schema.adminSessions).values({
    id,
    userId,
    remember: opts.remember,
    mfaVerifiedAt: opts.mfaVerified ? opts.now : null,
    expiresAt,
    lastSeenAt: opts.now,
    userAgent: opts.userAgent?.slice(0, 300) ?? null,
    createdAt: opts.now,
  })
  return {
    token,
    session: { id, userId, mfaVerified: opts.mfaVerified, remember: opts.remember, expiresAt },
  }
}

export type SessionCheck =
  | { status: 'valid'; session: Session; user: schema.AdminUser; renewedUntil: Date | null }
  | { status: 'pending'; session: Session; user: schema.AdminUser }
  | { status: 'expired' }
  | { status: 'none' }

/**
 * Validates a cookie token. Applies the idle limit, slides "remember me"
 * sessions and throttles `last_seen_at` writes.
 */
export async function checkSession(
  db: Db,
  token: string | undefined,
  now: Date,
): Promise<SessionCheck> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: 'none' }
  const [row] = await db
    .select({ s: schema.adminSessions, u: schema.adminUsers })
    .from(schema.adminSessions)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.adminSessions.userId))
    .where(eq(schema.adminSessions.id, hashToken(token)))
  if (!row) return { status: 'none' }
  const { s, u } = row
  const idleLimit = addMinutes(s.lastSeenAt, POLICY.idleHours * 60)
  if (
    s.revokedAt ||
    u.disabledAt ||
    s.expiresAt <= now ||
    (s.mfaVerifiedAt && !s.remember && idleLimit <= now)
  ) {
    return { status: 'expired' }
  }
  const session: Session = {
    id: s.id,
    userId: s.userId,
    mfaVerified: Boolean(s.mfaVerifiedAt),
    remember: s.remember,
    expiresAt: s.expiresAt,
  }
  if (!s.mfaVerifiedAt) return { status: 'pending', session, user: u }

  let renewedUntil: Date | null = null
  const updates: Partial<typeof schema.adminSessions.$inferInsert> = {}
  if (addMinutes(s.lastSeenAt, POLICY.lastSeenEveryMin) <= now) updates.lastSeenAt = now
  if (s.remember) {
    const full = addMinutes(now, POLICY.rememberDays * 24 * 60)
    // Slide only when less than half of the period is left (few writes).
    if (s.expiresAt.getTime() - now.getTime() < (POLICY.rememberDays / 2) * 86_400_000) {
      updates.expiresAt = full
      renewedUntil = full
    }
  }
  if (Object.keys(updates).length) {
    await db.update(schema.adminSessions).set(updates).where(eq(schema.adminSessions.id, s.id))
  }
  return {
    status: 'valid',
    session: { ...session, expiresAt: renewedUntil ?? s.expiresAt },
    user: u,
    renewedUntil,
  }
}

export async function revokeSession(db: Db, token: string, now: Date) {
  await db
    .update(schema.adminSessions)
    .set({ revokedAt: now })
    .where(
      and(eq(schema.adminSessions.id, hashToken(token)), isNull(schema.adminSessions.revokedAt)),
    )
}

export async function revokeAllSessions(db: Db, userId: string, now: Date, exceptId?: string) {
  await db
    .update(schema.adminSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(schema.adminSessions.userId, userId),
        isNull(schema.adminSessions.revokedAt),
        exceptId ? sql`${schema.adminSessions.id} <> ${exceptId}` : undefined,
      ),
    )
}

// ── Step 1: password ─────────────────────────────────────────────────────────

export type PasswordResult =
  | { kind: 'ok'; token: string; expiresAt: Date; needsEnrollment: boolean }
  | { kind: 'invalid' }
  | { kind: 'locked' }

export async function loginWithPassword(
  db: Db,
  input: { email: string; password: string; remember: boolean },
  client: ClientInfo,
  deps: AuthDeps,
): Promise<PasswordResult> {
  const email = input.email.trim().toLowerCase()
  const accountKey = key('login:email', email, deps.secret)
  const ipKey = client.ip ? key('login:ip', client.ip, deps.secret) : null
  const since = addMinutes(deps.now, -POLICY.lockWindowMin)

  const [accountFailures, ipFailures] = await Promise.all([
    failuresSince(db, accountKey, since),
    ipKey ? failuresSince(db, ipKey, addMinutes(deps.now, -POLICY.ipWindowMin)) : 0,
  ])
  if (accountFailures >= POLICY.maxFailuresPerAccount || ipFailures >= POLICY.maxFailuresPerIp) {
    await audit(db, deps.secret, { action: 'login.locked', ip: client.ip, now: deps.now })
    return { kind: 'locked' }
  }

  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email))
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()))
  if (!user || !ok || user.disabledAt) {
    await record(db, [accountKey, ...(ipKey ? [ipKey] : [])], false, deps.now)
    await audit(db, deps.secret, {
      actorId: user?.id ?? null,
      action: 'login.failed',
      ip: client.ip,
      now: deps.now,
    })
    return { kind: 'invalid' }
  }

  await clearFailures(db, accountKey, deps.now)
  if (needsRehash(user.passwordHash)) {
    await db
      .update(schema.adminUsers)
      .set({ passwordHash: await hashPassword(input.password) })
      .where(eq(schema.adminUsers.id, user.id))
  }
  const { token, session } = await createSession(db, user.id, {
    remember: input.remember,
    mfaVerified: false,
    now: deps.now,
    userAgent: client.userAgent,
  })
  await audit(db, deps.secret, {
    actorId: user.id,
    action: 'login.password_ok',
    ip: client.ip,
    now: deps.now,
  })
  return { kind: 'ok', token, expiresAt: session.expiresAt, needsEnrollment: !user.totpEnabledAt }
}

// ── Step 2: second factor ────────────────────────────────────────────────────

export type MfaResult =
  | { kind: 'ok'; token: string; expiresAt: Date; remember: boolean }
  | { kind: 'invalid'; attemptsLeft: number }
  | { kind: 'locked' }
  | { kind: 'expired' }

async function finishLogin(
  db: Db,
  pending: Session,
  client: ClientInfo,
  deps: AuthDeps,
): Promise<{ token: string; expiresAt: Date; remember: boolean }> {
  // New token after the privilege change (session fixation defence).
  await db
    .update(schema.adminSessions)
    .set({ revokedAt: deps.now })
    .where(eq(schema.adminSessions.id, pending.id))
  const { token, session } = await createSession(db, pending.userId, {
    remember: pending.remember,
    mfaVerified: true,
    now: deps.now,
    userAgent: client.userAgent,
  })
  return { token, expiresAt: session.expiresAt, remember: pending.remember }
}

export async function verifySecondFactor(
  db: Db,
  pendingToken: string | undefined,
  code: string,
  client: ClientInfo,
  deps: AuthDeps,
): Promise<MfaResult> {
  const check = await checkSession(db, pendingToken, deps.now)
  if (check.status !== 'pending' || !check.user.totpEnabledAt || !check.user.totpSecretEnc) {
    return { kind: 'expired' }
  }
  const { user, session } = check
  const mfaKey = `mfa:${user.id}`
  const since = addMinutes(deps.now, -POLICY.lockWindowMin)
  const failures = await failuresSince(db, mfaKey, since)
  if (failures >= POLICY.maxMfaFailures) {
    await revokeSession(db, pendingToken!, deps.now)
    return { kind: 'locked' }
  }

  const clean = code.replace(/\s/g, '')
  let accepted = false
  let usedRecovery = false
  if (/^\d{6}$/.test(clean)) {
    const secret = decryptField(user.totpSecretEnc!, deps.keyRing, TOTP_AAD)
    const step = verifyTotp(secret, clean, deps.now, user.totpLastStep)
    if (step !== null) {
      // Conditional update: two concurrent requests with the same code cannot both pass.
      const updated = await db
        .update(schema.adminUsers)
        .set({ totpLastStep: step })
        .where(
          and(
            eq(schema.adminUsers.id, user.id),
            sql`coalesce(${schema.adminUsers.totpLastStep}, -1) < ${step}`,
          ),
        )
        .returning({ id: schema.adminUsers.id })
      accepted = updated.length === 1
    }
  } else if (looksLikeRecoveryCode(clean)) {
    const hash = hashRecoveryCode(clean)
    const updated = await db
      .update(schema.adminUsers)
      .set({
        recoveryCodeHashes: sql`array_remove(${schema.adminUsers.recoveryCodeHashes}, ${hash})`,
      })
      .where(
        and(
          eq(schema.adminUsers.id, user.id),
          sql`${hash} = any(${schema.adminUsers.recoveryCodeHashes})`,
        ),
      )
      .returning({ left: schema.adminUsers.recoveryCodeHashes })
    accepted = updated.length === 1
    usedRecovery = accepted
  }

  if (!accepted) {
    await record(db, [mfaKey], false, deps.now)
    await audit(db, deps.secret, {
      actorId: user.id,
      action: 'mfa.failed',
      ip: client.ip,
      now: deps.now,
    })
    const left = POLICY.maxMfaFailures - failures - 1
    if (left <= 0) {
      await revokeSession(db, pendingToken!, deps.now)
      return { kind: 'locked' }
    }
    return { kind: 'invalid', attemptsLeft: left }
  }

  await clearFailures(db, mfaKey, deps.now)
  const result = await finishLogin(db, session, client, deps)
  await audit(db, deps.secret, {
    actorId: user.id,
    action: usedRecovery ? 'login.recovery_code' : 'login.success',
    ip: client.ip,
    now: deps.now,
  })
  return { kind: 'ok', ...result }
}

// ── 2FA setup (first login, or after a reset by the emergency admin) ─────────

/** Returns the secret to show as a QR code. Re-uses an unconfirmed one. */
export async function beginTotpEnrollment(
  db: Db,
  pendingToken: string | undefined,
  deps: AuthDeps,
): Promise<{ secret: string; email: string } | null> {
  const check = await checkSession(db, pendingToken, deps.now)
  if (check.status !== 'pending' || check.user.totpEnabledAt) return null
  const { user } = check
  if (user.totpSecretEnc) {
    return { secret: decryptField(user.totpSecretEnc, deps.keyRing, TOTP_AAD), email: user.email }
  }
  const secret = generateTotpSecret()
  await db
    .update(schema.adminUsers)
    .set({ totpSecretEnc: encryptField(secret, deps.keyRing, TOTP_AAD) })
    .where(and(eq(schema.adminUsers.id, user.id), isNull(schema.adminUsers.totpEnabledAt)))
  return { secret, email: user.email }
}

export type EnrollResult =
  | { kind: 'ok'; token: string; expiresAt: Date; remember: boolean; recoveryCodes: string[] }
  | { kind: 'invalid' }
  | { kind: 'expired' }

export async function confirmTotpEnrollment(
  db: Db,
  pendingToken: string | undefined,
  code: string,
  client: ClientInfo,
  deps: AuthDeps,
): Promise<EnrollResult> {
  const check = await checkSession(db, pendingToken, deps.now)
  if (check.status !== 'pending' || check.user.totpEnabledAt || !check.user.totpSecretEnc) {
    return { kind: 'expired' }
  }
  const { user, session } = check
  const secret = decryptField(user.totpSecretEnc!, deps.keyRing, TOTP_AAD)
  const step = verifyTotp(secret, code.replace(/\s/g, ''), deps.now)
  if (step === null) {
    await record(db, [`mfa:${user.id}`], false, deps.now)
    return { kind: 'invalid' }
  }
  const recoveryCodes = generateRecoveryCodes()
  await db
    .update(schema.adminUsers)
    .set({
      totpEnabledAt: deps.now,
      totpLastStep: step,
      recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
    })
    .where(eq(schema.adminUsers.id, user.id))
  const result = await finishLogin(db, session, client, deps)
  await audit(db, deps.secret, {
    actorId: user.id,
    action: 'mfa.enrolled',
    ip: client.ip,
    now: deps.now,
  })
  return { kind: 'ok', ...result, recoveryCodes }
}

// ── Password reset ───────────────────────────────────────────────────────────

/** Always behaves the same for unknown addresses. Returns true if an e-mail was queued. */
export async function requestPasswordReset(
  db: Db,
  rawEmail: string,
  client: ClientInfo,
  deps: AuthDeps,
): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase()
  const resetKey = key('reset:email', email, deps.secret)
  if ((await failuresSince(db, resetKey, addMinutes(deps.now, -60))) >= 3) return false
  // Every request counts toward the throttle above, whether or not the address exists.
  await record(db, [resetKey], false, deps.now)

  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email))
  if (!user || user.disabledAt) return false
  await enqueueEmail(db, {
    kind: 'admin_password_reset',
    recipient: 'admin',
    adminUserId: user.id,
    dedupeKey: `admin_password_reset:${user.id}:${deps.now.getTime()}`,
    createdAt: deps.now,
  })
  await audit(db, deps.secret, {
    actorId: user.id,
    action: 'password.reset_requested',
    ip: client.ip,
    now: deps.now,
  })
  return true
}

/** Called by the e-mail sender: the link is minted at send time, like client links. */
export async function issuePasswordResetToken(db: Db, userId: string, now: Date): Promise<string> {
  const token = generateToken()
  await db.insert(schema.adminPasswordResets).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: addMinutes(now, POLICY.resetTokenMin),
    createdAt: now,
  })
  return token
}

export async function resetTokenValid(db: Db, token: string, now: Date): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false
  const [row] = await db
    .select({ userId: schema.adminPasswordResets.userId })
    .from(schema.adminPasswordResets)
    .where(
      and(
        eq(schema.adminPasswordResets.tokenHash, hashToken(token)),
        isNull(schema.adminPasswordResets.usedAt),
        gt(schema.adminPasswordResets.expiresAt, now),
      ),
    )
  return Boolean(row)
}

export type ResetResult =
  { kind: 'ok' } | { kind: 'invalid-token' } | { kind: 'weak'; message: string }

/**
 * Sets a new password and signs out every device. The second factor stays:
 * a stolen inbox alone is not enough to enter the panel.
 */
export async function resetPassword(
  db: Db,
  token: string,
  newPassword: string,
  client: ClientInfo,
  deps: AuthDeps,
): Promise<ResetResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { kind: 'invalid-token' }
  const [claimed] = await db
    .update(schema.adminPasswordResets)
    .set({ usedAt: deps.now })
    .where(
      and(
        eq(schema.adminPasswordResets.tokenHash, hashToken(token)),
        isNull(schema.adminPasswordResets.usedAt),
        gt(schema.adminPasswordResets.expiresAt, deps.now),
      ),
    )
    .returning({ userId: schema.adminPasswordResets.userId })
  if (!claimed) return { kind: 'invalid-token' }
  const [user] = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, claimed.userId))
  if (!user) return { kind: 'invalid-token' }
  const problem = passwordProblem(newPassword, user.email)
  if (problem) {
    // Give the token back: a weak choice should not burn the link.
    await db
      .update(schema.adminPasswordResets)
      .set({ usedAt: null })
      .where(eq(schema.adminPasswordResets.tokenHash, hashToken(token)))
    return { kind: 'weak', message: problem }
  }
  await db
    .update(schema.adminUsers)
    .set({
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: deps.now,
      updatedAt: deps.now,
    })
    .where(eq(schema.adminUsers.id, user.id))
  await revokeAllSessions(db, user.id, deps.now)
  await audit(db, deps.secret, {
    actorId: user.id,
    action: 'password.reset',
    ip: client.ip,
    now: deps.now,
  })
  return { kind: 'ok' }
}

// ── Administration (CLI) ─────────────────────────────────────────────────────

export async function createAdminUser(
  db: Db,
  input: { email: string; name: string; password: string },
  now: Date,
): Promise<string> {
  const email = input.email.trim().toLowerCase()
  const problem = passwordProblem(input.password, email)
  if (problem) throw new Error(problem)
  const [row] = await db
    .insert(schema.adminUsers)
    .values({
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: schema.adminUsers.id })
  return row!.id
}

/** Emergency: the user sets up 2FA again on the next login. Signs out everywhere. */
export async function resetTwoFactor(db: Db, email: string, now: Date): Promise<boolean> {
  const [user] = await db
    .update(schema.adminUsers)
    .set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [] })
    .where(eq(schema.adminUsers.email, email.trim().toLowerCase()))
    .returning({ id: schema.adminUsers.id })
  if (!user) return false
  await revokeAllSessions(db, user.id, now)
  return true
}
