'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { LsrMonogram } from './monograms'

const NAV = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Serviços' },
  { href: '/#portfolio', label: 'Portfólio' },
  { href: '/#depoimentos', label: 'Depoimentos' },
  { href: '/#contato', label: 'Contato' },
] as const

/**
 * Fixed header: transparent over the hero, solid with a hairline after 24px of
 * scroll. Below 1100px the navigation collapses into the burger menu.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const burgerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        burgerRef.current?.focus()
      }
    }
    // The menu only exists below 1100px; close it if the viewport grows.
    const desktop = window.matchMedia('(min-width: 68.75rem)')
    const onResize = () => desktop.matches && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onResize)
    }
  }, [menuOpen])

  const close = () => setMenuOpen(false)
  const headerClass = [
    'lsr-header',
    scrolled || menuOpen ? 'is-solid' : '',
    scrolled ? 'is-scrolled' : '',
  ].join(' ')

  return (
    <header className={headerClass}>
      <div className="lsr-header-bar">
        <Link href="/#inicio" className="lsr-brand">
          <LsrMonogram size={52} />
          <span className="lsr-brand-name">
            <span>Luísa Ramos</span>
            <span>
              Make-up artist<span className="sr-only">, voltar ao início</span>
            </span>
          </span>
        </Link>

        <nav className="lsr-nav-desktop" aria-label="Menu principal">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="lsr-nav-link">
              {item.label}
            </a>
          ))}
        </nav>
        <Link href="/agendar" className="lsr-btn lsr-btn-ghost lsr-header-cta">
          Agendar
        </Link>

        <button
          ref={burgerRef}
          type="button"
          className="lsr-burger"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="menu-mobile"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="lsr-burger-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {menuOpen && (
        <nav id="menu-mobile" className="lsr-menu" aria-label="Menu">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={close}>
              {item.label}
            </a>
          ))}
          <Link href="/agendar" className="lsr-btn lsr-btn-gold" onClick={close}>
            Agendar horário
          </Link>
        </nav>
      )}
    </header>
  )
}
