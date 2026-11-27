import type { NextConfig } from 'next'

import { parseServerEnv } from './src/env/schema'
import { baseSecurityHeaders, buildCsp } from './src/lib/security/headers'

// Fail the build early if the environment is invalid.
const buildEnv = parseServerEnv(process.env)

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  /*
   * Netlify only exposes netlify.toml variables (and CONTEXT/URL/COMMIT_REF) at
   * BUILD time, not to the server functions at runtime. These non-secret values
   * are resolved during the build and inlined, so the running server knows which
   * environment it is. Secrets must NEVER go here: they come from the Netlify UI
   * at runtime.
   */
  env: {
    APP_ENV: buildEnv.APP_ENV,
    NEXT_PUBLIC_SITE_URL: buildEnv.NEXT_PUBLIC_SITE_URL,
    SITE_INDEXABLE: String(buildEnv.SITE_INDEXABLE),
    COMMIT_REF: buildEnv.COMMIT_REF ?? '',
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: baseSecurityHeaders({ isDev }),
      },
      {
        // Static CSP for everything except the nonce-protected areas handled in src/proxy.ts.
        source: '/((?!agendar(?:/|$)|admin(?:/|$)|a/).*)',
        headers: [{ key: 'Content-Security-Policy', value: buildCsp({ isDev }) }],
      },
    ]
  },
}

export default nextConfig
