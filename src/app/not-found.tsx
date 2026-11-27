import type { Metadata } from 'next'

import { StatusPage } from '@/components/status-page'

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <StatusPage
      kicker="Erro 404"
      title="Página não encontrada"
      description="O endereço pode ter mudado ou não existe mais. Que tal voltar ao início?"
      action={{ href: '/', label: 'Voltar ao início' }}
    />
  )
}
