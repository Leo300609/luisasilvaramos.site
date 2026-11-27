import { SERVICES, TAGLINE } from '@/content/site'
import { CONTACT, instagramUrl } from '@/lib/contact'

/**
 * JSON-LD for local SEO. The business serves at the client's address (no studio),
 * so there is no street address. Prices are left out until the Luísa confirms them.
 */
export function businessJsonLd(siteUrl: string) {
  const url = new URL('/', siteUrl).toString()
  return {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    '@id': `${url}#negocio`,
    name: 'Luísa Silva Ramos · Maquiadora Profissional',
    description: TAGLINE,
    url,
    image: new URL('/opengraph-image', siteUrl).toString(),
    telephone: `+${CONTACT.whatsappE164}`,
    email: CONTACT.email,
    founder: { '@type': 'Person', name: 'Luísa Silva Ramos', jobTitle: 'Maquiadora profissional' },
    sameAs: CONTACT.instagramHandle ? [instagramUrl(CONTACT.instagramHandle)] : undefined,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Serviços de maquiagem',
      itemListElement: SERVICES.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.title,
          description: service.description,
        },
      })),
    },
  }
}

/** Serializes JSON-LD safely for a <script> tag (no "</script>" breakout). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
