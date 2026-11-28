import Link from 'next/link'

import { LsrLogo } from '@/components/site/monograms'

/** Split screen of the access pages: brand on the left (top on mobile), card on the right. */
export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm-auth">
      <section className="adm-auth-brand" aria-label="Painel da Luísa">
        <div className="adm-auth-blob" aria-hidden="true" />
        <div className="adm-auth-ring" aria-hidden="true" />
        <span style={{ position: 'relative' }}>
          <LsrLogo width={260} tone="dark" priority />
        </span>
        <span className="adm-auth-kicker">Área restrita · Painel da Luísa</span>
        <p className="adm-auth-quote">
          Bem-vinda de volta. Cada agenda bem cuidada é uma cliente mais feliz.
        </p>
      </section>
      <main id="conteudo" className="adm-auth-main">
        <div className="adm-card">{children}</div>
        <p className="adm-foot">
          <span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="5" y="10.5" width="14" height="10" rx="2" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            </svg>
            Acesso restrito à administração
          </span>
          <Link href="/">Voltar ao site</Link>
        </p>
      </main>
    </div>
  )
}
