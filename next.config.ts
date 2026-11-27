import type { NextConfig } from 'next'

import { parseServerEnv } from './src/env/schema'
import { baseSecurityHeaders, buildCsp } from './src/lib/security/headers'

// Fail the build early if the environment is invalid.
parseServerEnv(process.env)

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
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
