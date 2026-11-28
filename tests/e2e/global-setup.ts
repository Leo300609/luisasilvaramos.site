import { rm } from 'node:fs/promises'
import path from 'node:path'

import { Client } from 'pg'

/**
 * Booking E2E tests need a database (BOOKING_E2E=1, DATABASE_URL set): start from
 * an empty agenda so "first available day/slot" is deterministic between runs.
 */
export default async function globalSetup() {
  if (process.env.BOOKING_E2E !== '1') return
  await rm(path.join(process.cwd(), '.emails'), { recursive: true, force: true })
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      'truncate email_outbox, booking_tokens, booking_events, bookings, customers restart identity cascade; alter sequence booking_code_seq restart',
    )
  } finally {
    await client.end()
  }
}
