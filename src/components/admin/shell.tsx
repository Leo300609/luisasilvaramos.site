'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LsrMonogram } from '@/components/site/monograms'

/** Icon paths from the canvas (two strokes each). */
const ICON = {
  dash: ['M4 4h7v7H4zM13 4h7v4h-7z', 'M13 10h7v10h-7zM4 13h7v7H4z'],
  agenda: [
    'M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z',
    'M3.5 10h17M8 3v4M16 3v4',
  ],
  clientes: [
    'M9 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6',
    'M16 4.5a3 3 0 0 1 0 6M18 14c2 .6 3.5 2.6 3.5 5.5',
  ],
  config: [
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1c-.6 0-1.2.4-1.5 1z',
  ],
  lista: ['M9 6h11M9 12h11M9 18h11', 'M4.5 6h.01M4.5 12h.01M4.5 18h.01'],
  sair: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 8l-4 4 4 4M6 12h10'],
} as const

const NAV = [
  { href: '/admin', label: 'Início', short: 'Início', icon: ICON.dash, exact: true, badge: false },
  {
    href: '/admin/agenda',
    label: 'Agenda',
    short: 'Agenda',
    icon: ICON.agenda,
    exact: false,
    badge: false,
  },
  {
    href: '/admin/agendamentos',
    label: 'Agendamentos',
    short: 'Lista',
    icon: ICON.lista,
    exact: false,
    badge: true,
  },
  {
    href: '/admin/clientes',
    label: 'Clientes',
    short: 'Clientes',
    icon: ICON.clientes,
    exact: false,
    badge: false,
  },
  {
    href: '/admin/ajustes',
    label: 'Ajustes',
    short: 'Ajustes',
    icon: ICON.config,
    exact: false,
    badge: false,
  },
] as const

const isCurrent = (pathname: string, item: (typeof NAV)[number]) =>
  item.exact ? pathname === item.href : pathname.startsWith(item.href)

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
  if (pathname === '/admin/agendamentos/novo') return 'Novo agendamento'
  if (/^\/admin\/agendamentos\/[^/]+/.test(pathname)) return 'Agendamento'
  if (pathname.startsWith('/admin/agendamentos')) return 'Agendamentos'
  if (pathname.startsWith('/admin/agenda/bloqueios')) return 'Bloqueios'
  if (pathname.startsWith('/admin/agenda')) return 'Agenda'
  if (/^\/admin\/clientes\/[^/]+/.test(pathname)) return 'Cliente'
  if (pathname.startsWith('/admin/clientes')) return 'Clientes'
  if (pathname.startsWith('/admin/ajustes')) return 'Ajustes'
  return 'Início'
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
            const current = isCurrent(pathname, item)
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
                {item.badge && pending > 0 && (
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
          <Link
            href="/admin/agendamentos/novo"
            className="adm-btn adm-btn-gold adm-new"
            aria-label="Novo agendamento"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="adm-new-label">Novo</span>
          </Link>
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
        {NAV.filter((i) => i.href !== '/admin/clientes').map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="adm-bottom-item"
            aria-current={isCurrent(pathname, item) ? 'page' : undefined}
          >
            <NavIcon paths={item.icon} />
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  )
}
