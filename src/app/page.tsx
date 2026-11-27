import type { Metadata } from 'next'

import { Contact } from '@/components/site/contact'
import { SiteFooter, WhatsAppFloat } from '@/components/site/footer'
import { SiteHeader } from '@/components/site/header'
import { Portfolio } from '@/components/site/portfolio'
import { About, FinalCta, Hero, Process, Services } from '@/components/site/sections'
import { Testimonials } from '@/components/site/testimonials'
import { env } from '@/env/server'
import { businessJsonLd, serializeJsonLd } from '@/lib/seo'

import './site.css'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <div className="lsr">
      <script
        type="application/ld+json"
        // JSON-LD is built from our own constants and escaped by serializeJsonLd.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(businessJsonLd(env.NEXT_PUBLIC_SITE_URL)),
        }}
      />
      <SiteHeader />
      <main id="conteudo">
        <Hero />
        <About />
        <Services />
        <Portfolio />
        <Process />
        <Testimonials />
        <FinalCta />
        <Contact />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </div>
  )
}
