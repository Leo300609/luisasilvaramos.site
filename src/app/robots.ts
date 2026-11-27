import type { MetadataRoute } from 'next'

import { env } from '@/env/server'

/**
 * Until go-live (SITE_INDEXABLE=true, production only) nothing is indexed.
 * Private areas and token links are never indexed.
 */
export default function robots(): MetadataRoute.Robots {
  if (!env.SITE_INDEXABLE) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/agendar/minha-agenda', '/a/'] },
    sitemap: new URL('/sitemap.xml', env.NEXT_PUBLIC_SITE_URL).toString(),
  }
}
