import type { Metadata, Viewport } from 'next'

import { env } from '@/env/server'

import { cormorant, jost, sora } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'Luísa Silva Ramos | Maquiadora Profissional',
    template: '%s | Luísa Silva Ramos',
  },
  description:
    'Luísa Silva Ramos, maquiadora profissional. Maquiagem social, para noivas, formaturas, eventos e festas. Agende o seu horário.',
  applicationName: 'Luísa Silva Ramos',
  robots: env.SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Luísa Silva Ramos',
    title: 'Luísa Silva Ramos | Maquiadora Profissional',
    description:
      'Maquiagem que valoriza o que você tem de mais bonito, para o seu dia mais especial.',
  },
}

export const viewport: Viewport = {
  themeColor: '#F5EBDD',
  colorScheme: 'light',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${jost.variable} ${sora.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-espresso px-5 py-3 text-sm font-medium text-cream transition-transform focus-visible:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  )
}
