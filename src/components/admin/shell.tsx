'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LsrMonogram } from '@/components/site/monograms'

/** Icon paths from the canvas (two strokes each). */
const ICON = {
  lista: ['M9 6h11M9 12h11M9 18h11', 'M4.5 6h.01M4.5 12h.01M4.5 18h.01'],
  sair: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 8l-4 4 4 4M6 12h10'],
} as const

/** Sections available so far; Dashboard, Agenda, Clientes, Serviços and Horários arrive in 5b/5c. */
const NAV = [
  { href: '/admin/agendamentos', label: 'Agendamentos', short: 'Lista', icon: ICON.lista },
] as const

function NavIcon({ paths }: { paths: readonly string[] }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

function titleFor(pathname: string): string {
  if (/^\/admin\/agendamentos\/[^/]+/.test(pathname)) return 'Agendamento'
  return 'Agendamentos'
}

export function AdminShell({
  user,
  pending,
  logout,
  logoutEverywhere,
  children,
}: {
  user: { name: string }
  pending: number
  logout: () => Promise<void>
  logoutEverywhere: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const first = user.name.trim().split(/\s+/)[0] ?? user.name
  const initials = user.name
    .trim()
    .split(/\s+/)
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className="adm-app">
      <aside className="adm-side" aria-label="Menu do painel">
        <div className="adm-side-brand">
          <LsrMonogram size={48} tone="dark" />
          <span className="adm-side-name">
            <span>Luísa Ramos</span>
            <span>Painel</span>
          </span>
        </div>
        <nav aria-label="Seções" className="adm-side-nav">
          {NAV.map((item) => {
            const current = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="adm-nav"
                aria-current={current ? 'page' : undefined}
                title={item.label}
              >
                <NavIcon paths={item.icon} />
                <span className="adm-nav-label">{item.label}</span>
                {pending > 0 && (
                  <span className="adm-badge" aria-label={`${pending} pendentes`}>
                    {pending}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <form action={logout}>
          <button type="submit" className="adm-nav adm-nav-out" title="Sair">
            <NavIcon paths={ICON.sair} />
            <span className="adm-nav-label">Sair</span>
          </button>
        </form>
      </aside>

      <div className="adm-body">
        <header className="adm-top">
          <span className="adm-top-mono">
            <LsrMonogram size={40} />
          </span>
          <h1 className="adm-top-title">{titleFor(pathname)}</h1>
          {pending > 0 && (
            <Link
              href="/admin/agendamentos?status=pendente"
              className="adm-pending-pill"
              aria-label={`${pending} ${pending === 1 ? 'pedido pendente' : 'pedidos pendentes'}`}
            >
              <span aria-hidden="true" className="adm-dot" />
              {pending}
              <span className="adm-pill-word" aria-hidden="true">
                {pending === 1 ? 'pendente' : 'pendentes'}
              </span>
            </Link>
          )}
          <details className="adm-account">
            <summary aria-label={`Conta de ${first}`}>
              <span className="adm-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="adm-account-name">
                <span>{first}</span>
                <span>Administradora</span>
              </span>
            </summary>
            <div className="adm-account-menu">
              <form action={logout}>
                <button type="submit">Sair</button>
              </form>
              <form action={logoutEverywhere}>
                <button type="submit">Sair de todos os dispositivos</button>
              </form>
            </div>
          </details>
        </header>

        <main id="conteudo" className="adm-main">
          {children}
        </main>
      </div>

      <nav className="adm-bottom" aria-label="Seções">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="adm-bottom-item"
            aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
          >
            <NavIcon paths={item.icon} />
            {item.short}
          </Link>
        ))}
        <form action={logout} style={{ display: 'contents' }}>
          <button type="submit" className="adm-bottom-item">
            <NavIcon paths={ICON.sair} />
            Sair
          </button>
        </form>
      </nav>
    </div>
  )
}
