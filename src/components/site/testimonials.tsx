'use client'

import { useState } from 'react'

import { TESTIMONIALS } from '@/content/site'

import { Avatar, ChevronLeft, ChevronRight, Stars, Twinkle } from './icons'
import { Kicker } from './kicker'

/** Testimonials carousel. Manual only (no autoplay), keyboard and screen-reader friendly. */
export function Testimonials() {
  const [index, setIndex] = useState(0)
  const total = TESTIMONIALS.length
  const current = TESTIMONIALS[index]
  if (!current) return null

  const go = (next: number) => setIndex((next + total) % total)

  return (
    <section
      id="depoimentos"
      className="lsr-section lsr-testimonials on-dark"
      aria-labelledby="depoimentos-title"
      aria-roledescription="carrossel"
    >
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 640,
          height: 640,
          right: -260,
          top: -260,
          border: '1px solid rgb(242 183 5 / .18)',
        }}
      />
      <div
        aria-hidden="true"
        className="lsr-ring"
        style={{
          width: 440,
          height: 440,
          right: -160,
          top: -160,
          border: '1px solid rgb(242 183 5 / .12)',
        }}
      />
      <Twinkle className="lsr-twinkle-2 absolute top-[18%] left-[8%]" size={22} color="#F2B705" />

      <div className="lsr-container relative">
        <div className="lsr-heading-center lsr-reveal">
          <Kicker centered>Depoimentos</Kicker>
          <h2 id="depoimentos-title" className="lsr-h2">
            O que dizem as <span className="lsr-accent">clientes</span>
          </h2>
        </div>

        <div className="lsr-quote-area lsr-reveal">
          <span className="lsr-quote-mark" aria-hidden="true">
            “
          </span>
          <div className="lsr-quote-slot" aria-live="polite">
            <figure
              key={index}
              className="lsr-quote"
              aria-roledescription="slide"
              aria-label={`${index + 1} de ${total}`}
            >
              <Stars />
              <blockquote>“{current.quote}”</blockquote>
              <figcaption>
                <span className="lsr-quote-avatar" aria-hidden="true">
                  <Avatar size={24} />
                </span>
                <span>
                  <cite>{current.author}</cite>
                  <small>{current.context}</small>
                </span>
              </figcaption>
            </figure>
          </div>

          <div className="lsr-carousel-nav">
            <button
              type="button"
              className="lsr-icon-btn"
              onClick={() => go(index - 1)}
              aria-label="Depoimento anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="lsr-dots">
              {TESTIMONIALS.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className="lsr-dot"
                  onClick={() => go(i)}
                  aria-label={`Mostrar depoimento ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lsr-icon-btn"
              onClick={() => go(index + 1)}
              aria-label="Próximo depoimento"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
