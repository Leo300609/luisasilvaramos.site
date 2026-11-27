import { describe, expect, it } from 'vitest'

import { SERVICES } from '@/content/site'
import { businessJsonLd, serializeJsonLd } from '@/lib/seo'

describe('businessJsonLd', () => {
  const data = businessJsonLd('https://luisasilvaramos.com.br')

  it('describes the business with absolute URLs', () => {
    expect(data['@type']).toBe('BeautySalon')
    expect(data.url).toBe('https://luisasilvaramos.com.br/')
    expect(data.telephone).toBe('+5511930546322')
  })

  it('lists every service and no prices (not confirmed yet)', () => {
    expect(data.hasOfferCatalog.itemListElement).toHaveLength(SERVICES.length)
    expect(JSON.stringify(data)).not.toMatch(/price/i)
  })

  it('has no street address: the service happens at the client', () => {
    expect(JSON.stringify(data)).not.toMatch(/streetAddress|estúdio/i)
  })
})

describe('serializeJsonLd', () => {
  it('cannot close the surrounding <script> tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})
