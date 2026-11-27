import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres@localhost:5433/lsr_test'

/** Recreates the schema from scratch and applies every migration, like a new environment. */
export default async function setup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 })
  try {
    await pool.query(
      'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
    )
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  } finally {
    await pool.end()
  }
}
