import type { Metadata } from 'next'
import { connection } from 'next/server'

import './admin.css'

export const metadata: Metadata = {
  title: { default: 'Painel da Luísa', template: '%s | Painel da Luísa' },
  robots: { index: false, follow: false },
}

/** Everything under /admin is per-request (session cookie) and never cached. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection()
  return <div className="adm">{children}</div>
}
