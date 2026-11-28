import { rm } from 'node:fs/promises'
import path from 'node:path'

import { Client } from 'pg'

import { hashPassword } from '../../src/server/auth/password'

/** One admin per Playwright project, so desktop and mobile runs never share a 2FA setup. */
export const E2E_ADMINS = {
  desktop: 'admin-desktop@exemplo.com',
  mobile: 'admin-mobile@exemplo.com',
} as const
export const E2E_ADMIN_PASSWORD = 'senha de teste bem longa'

/**
 * Booking E2E tests need a database (BOOKING_E2E=1, DATABASE_URL set): start from
 * an empty agenda so "first available day/slot" is deterministic between runs,
 * and from admins without 2FA so the setup screen is exercised every run.
 */
export default async function globalSetup() {
  if (process.env.BOOKING_E2E !== '1') return
  await rm(path.join(process.cwd(), '.emails'), { recursive: true, force: true })
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      'truncate rate_limits, job_runs, blocks, auth_attempts, admin_password_resets, admin_sessions, email_outbox, booking_tokens, booking_events, bookings, customers restart identity cascade; alter sequence booking_code_seq restart',
    )
    const hash = await hashPassword(E2E_ADMIN_PASSWORD)
    for (const email of Object.values(E2E_ADMINS)) {
      await client.query(
        `insert into admin_users (email, name, password_hash) values ($1, 'Luísa Teste', $2)
         on conflict (email) do update set password_hash = excluded.password_hash,
           totp_secret_enc = null, totp_enabled_at = null, totp_last_step = null,
           recovery_code_hashes = '{}', disabled_at = null`,
        [email, hash],
      )
    }
  } finally {
    await client.end()
  }
}
