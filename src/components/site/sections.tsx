import Image from 'next/image'
import Link from 'next/link'

import {
  ABOUT_HIGHLIGHTS,
  ABOUT_PARAGRAPHS,
  HERO_STATS,
  PROCESS_STEPS,
  SERVICES,
  TAGLINE,
} from '@/content/site'
import { DEFAULT_WHATSAPP_MESSAGE, whatsappLink } from '@/lib/contact'

import { ArrowRight, Clock, Person, ServiceIcon, Sparkle, Twinkle, WhatsApp } from './icons'
import { Kicker } from './kicker'
import portrait from '@/assets/luisa-retrato.webp'

export function Hero() {
  return (
    <section id="inicio" className="lsr-hero" aria-labelledby="hero-title">
      <div className="lsr-grain" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 520,
          height: 520,
          left: -220,
          bottom: -260,
          border: '1px solid rgb(201 151 43 / .35)',
        }}
      />
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 380,
          height: 380,
          left: -150,
          bottom: -190,
          border: '1px solid rgb(201 151 43 / .22)',
        }}
      />
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 180,
          height: 180,
          left: '38%',
          top: '14%',
          background: 'rgb(248 222 126 / .35)',
          filter: 'blur(2px)',
        }}
      />

      <div className="lsr-hero-grid">
        <div className="lsr-hero-copy">
          <Kicker>Luísa Silva Ramos</Kicker>
          <div className="lsr-h1-wrap">
            <h1 id="hero-title" className="lsr-h1">
              <span>Realce a sua</span>
              <span className="lsr-h1-accent">beleza</span>
            </h1>
            <p className="lsr-hero-sub">Maquiagem profissional</p>
          </div>
          <p className="lsr-hero-lead">{TAGLINE}</p>
          <div className="lsr-hero-actions">
            <Link href="/agendar" className="lsr-btn lsr-btn-gold">
              Agendar horário
              <ArrowRight size={18} />
            </Link>
            <a href="#portfolio" className="lsr-link">
              Ver portfólio
              <ArrowRight size={16} />
            </a>
          </div>
          <dl className="lsr-stats m-0">
            {HERO_STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="m-0 flex flex-col gap-1">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lsr-hero-art">
          <div className="lsr-hero-blob" aria-hidden="true" />
          <svg
            className="lsr-hero-orbit lsr-orbit"
            aria-hidden="true"
            viewBox="0 0 200 200"
            fill="none"
          >
            <ellipse
              cx="100"
              cy="100"
              rx="97"
              ry="62"
              transform="rotate(-18 100 100)"
              stroke="#C9972B"
              strokeWidth=".4"
            />
            <circle cx="191" cy="70" r="1.6" fill="#C9972B" />
          </svg>
          <div className="lsr-hero-photo lsr-parallax">
            <Image
              src={portrait}
              alt="Luísa Silva Ramos, maquiadora profissional, com óculos de armação tartaruga e cabelo escuro em cachos"
              fill
              loading="eager"
              fetchPriority="high"
              quality={70}
              sizes="(min-width: 1100px) 580px, (min-width: 720px) 520px, 360px"
            />
          </div>
          <Twinkle
            className="lsr-twinkle absolute top-[22%] left-[-2%]"
            size={30}
            color="#C9972B"
          />
          <Twinkle
            className="lsr-twinkle-2 absolute top-[10%] right-[4%]"
            size={18}
            color="#C9972B"
          />
          <Twinkle
            className="lsr-twinkle-3 absolute top-[46%] right-[-1%]"
            size={14}
            color="#2B1D14"
            opacity={0.55}
          />
          <div className="lsr-badge">
            <span className="lsr-badge-icon" aria-hidden="true">
              <Clock size={20} strokeWidth={1.3} />
            </span>
            <span className="lsr-badge-text">
              <span>Make que dura</span>
              <span>o dia todo</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

const HIGHLIGHT_ICONS = { sparkle: Sparkle, person: Person, clock: Clock } as const

export function About() {
  return (
    <section id="sobre" className="lsr-section bg-cream" aria-labelledby="sobre-title">
      <div className="lsr-container lsr-about-grid">
        <div className="lsr-about-art lsr-reveal">
          <div className="lsr-about-outline" aria-hidden="true" />
          <div className="lsr-about-frame">
            <Image
              src={portrait}
              alt="Retrato de Luísa Silva Ramos sorrindo levemente"
              fill
              sizes="(min-width: 1100px) 520px, 100vw"
            />
          </div>
          <div className="lsr-about-detail">
            <Image
              src={portrait}
              alt="Detalhe do olhar da Luísa com óculos tartaruga"
              fill
              sizes="170px"
            />
          </div>
          <Twinkle
            className="lsr-twinkle absolute top-[10%] left-[-4%]"
            size={26}
            color="#C9972B"
          />
        </div>

        <div className="lsr-about-copy lsr-reveal">
          <Kicker>Sobre mim</Kicker>
          <h2 id="sobre-title" className="lsr-h2">
            Conheça a <span className="lsr-accent">Luísa</span>
          </h2>
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="lsr-signature">Luísa Silva Ramos</p>
          <div className="lsr-highlights">
            {ABOUT_HIGHLIGHTS.map((item) => {
              const Icon = HIGHLIGHT_ICONS[item.icon]
              return (
                <div key={item.title}>
                  <span className="lsr-highlight-icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={1.25} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export function Services() {
  return (
    <section id="servicos" className="lsr-section" aria-labelledby="servicos-title">
      <div className="lsr-container">
        <div className="lsr-heading-center lsr-reveal">
          <Kicker centered>Serviços</Kicker>
          <h2 id="servicos-title" className="lsr-h2">
            Uma make para cada <span className="lsr-accent">momento</span>
          </h2>
          <p className="lsr-lead">
            Do dia a dia às grandes celebrações, cada atendimento é pensado para valorizar você.
          </p>
        </div>
        <div className="lsr-cards lsr-reveal">
          {SERVICES.map((service) => (
            <article key={service.slug} className="lsr-card">
              <span className="lsr-card-number" aria-hidden="true">
                {service.number}
              </span>
              <span className="lsr-card-icon" aria-hidden="true">
                <ServiceIcon name={service.icon} size={28} />
              </span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <Link
                href={{ pathname: '/agendar', query: { servico: service.slug } }}
                className="lsr-link"
                aria-label={`Agendar ${service.title}`}
              >
                Agendar
                <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Process() {
  return (
    <section id="processo" className="lsr-section lsr-process" aria-labelledby="processo-title">
      <div className="lsr-container">
        <div className="lsr-heading-center lsr-reveal">
          <Kicker centered>Como funciona</Kicker>
          <h2 id="processo-title" className="lsr-h2">
            Do primeiro contato ao <span className="lsr-accent">resultado</span>
          </h2>
        </div>
        <ol className="lsr-steps lsr-reveal">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="lsr-step">
              <span className="lsr-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div className="lsr-step-text">
                <h3>
                  <span className="sr-only">Passo {index + 1}: </span>
                  {step.title}
                </h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="lsr-cta" aria-labelledby="cta-title">
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 560,
          height: 560,
          left: -200,
          top: -300,
          border: '1px solid rgb(43 29 20 / .16)',
        }}
      />
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 420,
          height: 420,
          right: -140,
          bottom: -260,
          border: '1px solid rgb(43 29 20 / .16)',
        }}
      />
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 300,
          height: 300,
          right: '12%',
          top: -120,
          background: 'rgb(248 222 126 / .6)',
        }}
      />
      <Twinkle
        className="lsr-twinkle absolute bottom-[22%] left-[12%]"
        size={26}
        color="#2B1D14"
        opacity={0.6}
      />
      <Twinkle
        className="lsr-twinkle-3 absolute top-[26%] right-[14%]"
        size={18}
        color="#2B1D14"
        opacity={0.6}
      />
      <div className="lsr-cta-inner lsr-reveal">
        <h2 id="cta-title">
          Vamos deixar você <em>inesquecível?</em>
        </h2>
        <p>Me chame no WhatsApp, conte sobre o seu evento e garanta a sua data na agenda.</p>
        <a
          className="lsr-btn lsr-btn-dark"
          href={whatsappLink(DEFAULT_WHATSAPP_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsApp size={20} />
          Chamar no WhatsApp
        </a>
      </div>
    </section>
  )
}
