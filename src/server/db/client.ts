import 'server-only'

import { env } from '@/env/server'

import { createDatabase, type Database } from './create'

export type { Database }

let cached: Database | undefined

/** The app's database (lazily created, reused across requests in the same function). */
export function getDb(): Database {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured (see .env.example, "Fase 3").')
  }
  cached ??= createDatabase(env.DATABASE_URL)
  return cached
}
