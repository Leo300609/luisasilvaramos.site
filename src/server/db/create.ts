import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

/**
 * Creates a Drizzle client over node-postgres. In serverless functions keep the
 * pool tiny: Neon's pooler (PgBouncer) does the real pooling.
 */
export function createDatabase(url: string, max = 3) {
  const pool = new Pool({
    connectionString: url,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // Never let a stuck query hold a serverless function open.
    statement_timeout: 10_000,
  })
  return Object.assign(drizzle(pool, { schema }), { $pool: pool })
}

export type Database = ReturnType<typeof createDatabase>
