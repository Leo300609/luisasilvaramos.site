/**
 * Applies pending migrations from ./drizzle.
 * Uses DATABASE_MIGRATION_URL (role with DDL rights), falling back to DATABASE_URL locally.
 *   npm run db:migrate
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_MIGRATION_URL (or DATABASE_URL) to run migrations.')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, max: 1 })
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  console.log('Migrations applied.')
} finally {
  await pool.end()
}
