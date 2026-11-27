import type { MetadataRoute } from 'next'

import { env } from '@/env/server'

/** Public, indexable pages only. Private areas and token links are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL
  return [
    { url: new URL('/', base).toString(), changeFrequency: 'monthly', priority: 1 },
    { url: new URL('/agendar', base).toString(), changeFrequency: 'monthly', priority: 0.8 },
  ]
}
