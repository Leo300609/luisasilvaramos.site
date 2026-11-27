import { defineConfig } from 'drizzle-kit'

/**
 * Migrations are generated from src/server/db/schema.ts (`npm run db:generate`)
 * plus hand-written SQL for constraints Drizzle cannot express. They are applied
 * with `npm run db:migrate`, using DATABASE_MIGRATION_URL (a role allowed to run DDL).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
