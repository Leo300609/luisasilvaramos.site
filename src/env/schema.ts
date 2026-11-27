import { z } from 'zod'

/**
 * Environment variables schema.
 *
 * Every variable the app reads must be declared here. The app validates them
 * once at boot (instrumentation.ts) and at build time (next.config.ts), so a
 * missing or malformed variable stops the deploy instead of failing silently
 * in production.
 *
 * Netlify injects CONTEXT ("production" | "deploy-preview" | "branch-deploy" |
 * "dev") and URL / DEPLOY_PRIME_URL. When APP_ENV / NEXT_PUBLIC_SITE_URL are not
 * set explicitly we derive them from those.
 */

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1')

export const appEnvSchema = z.enum(['local', 'test', 'preview', 'production'])
export type AppEnv = z.infer<typeof appEnvSchema>

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: appEnvSchema,
    NEXT_PUBLIC_SITE_URL: z.url({ protocol: /^https?$/ }),
    /** Only "true" in the real production site after go-live. */
    SITE_INDEXABLE: booleanString.default(false),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    /** Git commit of the running build (Netlify sets COMMIT_REF). */
    COMMIT_REF: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && !env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'must use https in production',
      })
    }
    if (env.SITE_INDEXABLE && env.APP_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['SITE_INDEXABLE'],
        message: 'only the production environment may be indexed',
      })
    }
  })

export type ServerEnv = z.infer<typeof serverEnvSchema>

type RawEnv = Record<string, string | undefined>

function deriveAppEnv(raw: RawEnv): string {
  if (raw.APP_ENV) return raw.APP_ENV
  if (raw.NODE_ENV === 'test') return 'test'
  switch (raw.CONTEXT) {
    case 'production':
      return 'production'
    case 'deploy-preview':
    case 'branch-deploy':
      return 'preview'
    default:
      return 'local'
  }
}

function deriveSiteUrl(raw: RawEnv, appEnv: string): string | undefined {
  if (raw.NEXT_PUBLIC_SITE_URL) return raw.NEXT_PUBLIC_SITE_URL
  if (appEnv === 'production') return raw.URL
  if (appEnv === 'preview') return raw.DEPLOY_PRIME_URL
  return 'http://localhost:3000'
}

/** Turns empty strings into undefined so optional vars can be left blank in .env files. */
function blankToUndefined(raw: RawEnv): RawEnv {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]))
}

export function parseServerEnv(input: RawEnv): ServerEnv {
  const raw = blankToUndefined(input)
  const appEnv = deriveAppEnv(raw)
  const result = serverEnvSchema.safeParse({
    ...raw,
    APP_ENV: appEnv,
    NEXT_PUBLIC_SITE_URL: deriveSiteUrl(raw, appEnv),
  })
  if (!result.success) {
    // Never print values: they may be secrets. Only names and reasons.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${problems}\nSee .env.example.`)
  }
  return result.data
}
