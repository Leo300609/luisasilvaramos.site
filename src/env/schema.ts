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
    /**
     * Postgres for the app (role without DDL). Optional so static pages build without
     * a database; code that needs it fails with a clear message (src/server/db/client.ts).
     */
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL')
      .optional(),
    /** Field-encryption keys: "v1:<base64 32 bytes>,v2:…" (see src/server/crypto/fields.ts). */
    ENC_KEYS: z
      .string()
      .regex(/^v\d+:[A-Za-z0-9+/=]{43,44}(,v\d+:[A-Za-z0-9+/=]{43,44})*$/, 'invalid format')
      .optional(),
    ENC_ACTIVE_KEY: z
      .string()
      .regex(/^v\d+$/)
      .optional(),
    /** HMAC secret that signs travel quotes (≥ 32 chars). Generate: openssl rand -base64 48 */
    BOOKING_SIGNING_SECRET: z.string().min(32).optional(),
    /** Resend API key (Phase 4b). Without it, e-mails wait in the outbox. */
    RESEND_API_KEY: z
      .string()
      .regex(/^re_[A-Za-z0-9_]{10,}$/, 'must be a Resend key (re_…)')
      .optional(),
    /** Sender, on a domain verified in Resend: "Luísa Silva Ramos <agenda@dominio>". */
    EMAIL_FROM: z
      .string()
      .regex(/^[^<>]+ <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/, 'use "Nome <email@dominio>"')
      .optional(),
    /** Where clients' replies go (the Luísa's inbox). */
    EMAIL_REPLY_TO: z.email().optional(),
    /** Receives new-booking / cancellation / reschedule notices. */
    EMAIL_ADMIN_NOTIFY: z.email().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && !env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'must use https in production',
      })
    }
    if (
      env.ENC_ACTIVE_KEY &&
      !env.ENC_KEYS?.split(',').some((k) => k.startsWith(`${env.ENC_ACTIVE_KEY}:`))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENC_ACTIVE_KEY'],
        message: 'must name one of the keys in ENC_KEYS',
      })
    }
    if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_FROM'],
        message: 'required when RESEND_API_KEY is set',
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
