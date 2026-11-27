import 'server-only'

import { parseServerEnv } from './schema'

/** Validated server environment. Importing this module fails fast if anything is wrong. */
export const env = parseServerEnv(process.env)
