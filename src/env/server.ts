import 'server-only'

import { parseServerEnv } from './schema'

/**
 * Validated server environment. Importing this module fails fast if anything is wrong.
 *
 * Each variable is read explicitly (process.env.NAME): values inlined at build time
 * by next.config.ts `env` are only replaced when accessed this way.
 */
export const env = parseServerEnv({
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SITE_INDEXABLE: process.env.SITE_INDEXABLE,
  LOG_LEVEL: process.env.LOG_LEVEL,
  COMMIT_REF: process.env.COMMIT_REF,
  CONTEXT: process.env.CONTEXT,
  URL: process.env.URL,
  DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
})
