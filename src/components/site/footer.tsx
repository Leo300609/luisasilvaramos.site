import { SERVICE_AREA, TAGLINE } from '@/content/site'
import { CONTACT, DEFAULT_WHATSAPP_MESSAGE, instagramUrl, whatsappLink } from '@/lib/contact'

import { Instagram, Mail, WhatsApp } from './icons'
import { LacMonogram, LsrLogo } from './monograms'

const NAV = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Serviços' },
  { href: '/#portfolio', label: 'Portfólio' },
  { href: '/#depoimentos', label: 'Depoimentos' },
  { href: '/#contato', label: 'Contato' },
] as const

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="lsr-footer on-dark">
      <div className="lsr-container">
        <div className="lsr-footer-grid">
          <div className="lsr-footer-brand">
            <LsrLogo width={220} tone="dark" />
            <p className="lsr-footer-title">
              <em>Maquiadora Profissional</em>
            </p>
            <p className="lsr-footer-tagline">{TAGLINE}</p>
          </div>

          <nav className="lsr-footer-nav" aria-labelledby="footer-nav-title">
            <p id="footer-nav-title" className="lsr-footer-heading m-0">
              NAVEGUE
            </p>
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="lsr-footer-social">
            <p className="lsr-footer-heading">REDES SOCIAIS</p>
            <div>
              {CONTACT.instagramHandle && (
                <a
                  className="lsr-social"
                  href={instagramUrl(CONTACT.instagramHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <Instagram size={20} />
                </a>
              )}
              <a
                className="lsr-social"
                href={whatsappLink(DEFAULT_WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
              >
                <WhatsApp size={20} />
              </a>
              <a className="lsr-social" href={`mailto:${CONTACT.email}`} aria-label="E-mail">
                <Mail size={20} />
              </a>
            </div>
            <p>
              {CONTACT.instagramHandle && (
                <>
                  {CONTACT.instagramHandle}
                  <br />
                </>
              )}
              {SERVICE_AREA}
            </p>
          </div>
        </div>

        <div className="lsr-footer-bottom">
          <p className="lsr-footer-legal">
            © {year} Luísa Silva Ramos. Todos os direitos reservados. ·{' '}
            <a href="/privacidade">Política de privacidade</a>
          </p>
          {/* TODO(Leo): link da assinatura, quando houver um site do desenvolvedor. */}
          <p className="lsr-signature-dev">
            <span>Desenvolvido por</span>
            <span aria-hidden="true" />
            <span>
              <LacMonogram size={26} />
              Leo Almeida Canto
            </span>
          </p>
        </div>
      </div>
    </footer>
  )
}

export function WhatsAppFloat() {
  return (
    <a
      className="lsr-wa"
      href={whatsappLink(DEFAULT_WHATSAPP_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
    >
      <WhatsApp size={28} strokeWidth={1.5} />
    </a>
  )
}
