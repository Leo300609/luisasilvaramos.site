import Link from 'next/link'

import { ChevronLeft } from '@/components/site/icons'
import { LsrMonogram } from '@/components/site/monograms'

export function AppHeader({ subtitle }: { subtitle: string }) {
  return (
    <header className="app-header">
      <div className="app-wrap">
        <Link href="/" className="app-brand">
          <LsrMonogram size={46} />
          <span>
            <span>Luísa Ramos</span>
            <span>
              {subtitle}
              <span className="sr-only">, voltar ao site</span>
            </span>
          </span>
        </Link>
        <Link href="/" className="app-btn app-btn-ghost hidden tablet:inline-flex">
          <ChevronLeft size={18} />
          Voltar ao site
        </Link>
      </div>
    </header>
  )
}
