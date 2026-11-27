'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

import { PORTFOLIO, type PortfolioItem } from '@/content/site'
import { CONTACT, instagramUrl } from '@/lib/contact'

import { Camera, ChevronLeft, ChevronRight, Close, Eye, Instagram } from './icons'
import { Kicker } from './kicker'

const TOTAL = PORTFOLIO.length
const pad = (n: number) => String(n).padStart(2, '0')

/** Distributes items round-robin into columns, like the design's masonry. */
function columns(count: number) {
  const cols: Array<Array<{ item: PortfolioItem; index: number }>> = Array.from(
    { length: count },
    () => [],
  )
  PORTFOLIO.forEach((item, index) => cols[index % count]?.push({ item, index }))
  return cols
}

function Tile({
  item,
  index,
  onOpen,
}: {
  item: PortfolioItem
  index: number
  onOpen: (index: number) => void
}) {
  const style = {
    '--tone': item.tone,
    '--h-desktop': `${item.heightDesktop}px`,
    '--h-mobile': `${item.heightMobile}px`,
  } as CSSProperties
  return (
    <button
      type="button"
      className="lsr-tile"
      style={style}
      onClick={() => onOpen(index)}
      aria-label={`Ampliar foto ${pad(index + 1)}, ${item.category}`}
    >
      {item.image ? (
        <Image src={item.image.src} alt="" fill sizes="(min-width: 720px) 33vw, 50vw" />
      ) : (
        <>
          <span className="lsr-tile-frame" aria-hidden="true" />
          <span className="lsr-tile-label" aria-hidden="true">
            <Camera size={30} />
            <strong>Foto {pad(index + 1)}</strong>
            <span>{item.category}</span>
          </span>
        </>
      )}
      <span className="lsr-tile-overlay" aria-hidden="true">
        <span>
          <Eye size={24} />
        </span>
        <span>VER</span>
      </span>
    </button>
  )
}

export function Portfolio() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [current, setCurrent] = useState<number | null>(null)

  const open = useCallback((index: number) => {
    setCurrent(index)
    dialogRef.current?.showModal()
  }, [])
  const close = useCallback(() => dialogRef.current?.close(), [])
  const step = useCallback(
    (delta: number) =>
      setCurrent((index) => (index === null ? 0 : (index + delta + TOTAL) % TOTAL)),
    [],
  )

  // Keyboard: ← → navigate while the lightbox is open (Esc is handled by <dialog>).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    const onClose = () => setCurrent(null)
    dialog.addEventListener('keydown', onKey)
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('keydown', onKey)
      dialog.removeEventListener('close', onClose)
    }
  }, [step])

  const item = current === null ? undefined : PORTFOLIO[current]
  const instagram = CONTACT.instagramHandle

  return (
    <section id="portfolio" className="lsr-section bg-cream" aria-labelledby="portfolio-title">
      <div className="lsr-container">
        <div className="lsr-pf-head lsr-reveal">
          <div>
            <Kicker>Portfólio</Kicker>
            <h2 id="portfolio-title" className="lsr-h2">
              Trabalhos que <span className="lsr-accent">encantam</span>
            </h2>
          </div>
          {instagram && (
            <a
              className="lsr-btn lsr-btn-ghost"
              href={instagramUrl(instagram)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={18} />
              Ver mais no Instagram
            </a>
          )}
        </div>

        {/* Two columns on mobile, three from tablet up (same order as the design). */}
        <div className="lsr-pf-grid is-mobile lsr-reveal">
          {columns(2).map((col, c) => (
            <div key={c} className="lsr-pf-col">
              {col.map(({ item: it, index }) => (
                <Tile key={index} item={it} index={index} onOpen={open} />
              ))}
            </div>
          ))}
        </div>
        <div className="lsr-pf-grid is-tablet lsr-reveal">
          {columns(3).map((col, c) => (
            <div key={c} className="lsr-pf-col">
              {col.map(({ item: it, index }) => (
                <Tile key={index} item={it} index={index} onOpen={open} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="lsr-lightbox on-dark"
        aria-label={item ? `Visualização da foto ${pad((current ?? 0) + 1)}` : 'Visualização'}
        onClick={(event) => {
          // Clicking the backdrop (the dialog itself, outside the content) closes it.
          if (event.target === event.currentTarget) close()
        }}
      >
        <button
          type="button"
          className="lsr-icon-btn lsr-lightbox-close"
          onClick={close}
          aria-label="Fechar"
        >
          <Close size={22} />
        </button>
        {item && current !== null && (
          <div className="lsr-lightbox-body">
            <button
              type="button"
              className="lsr-icon-btn"
              onClick={() => step(-1)}
              aria-label="Foto anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <figure>
              <div className="lsr-lightbox-media" style={{ background: item.tone }}>
                {item.image ? (
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    fill
                    sizes="(min-width: 1100px) 860px, 90vw"
                    className="object-contain"
                  />
                ) : (
                  <>
                    <span className="lsr-tile-frame" aria-hidden="true" />
                    <Camera size={44} strokeWidth={1.1} className="text-[#A67814]" />
                    <strong>Foto {pad(current + 1)}</strong>
                    <span>Foto em breve</span>
                  </>
                )}
              </div>
              <figcaption aria-live="polite">
                <span>{item.category}</span>
                <span>
                  {pad(current + 1)} / {pad(TOTAL)}
                </span>
              </figcaption>
            </figure>
            <button
              type="button"
              className="lsr-icon-btn"
              onClick={() => step(1)}
              aria-label="Próxima foto"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </dialog>
    </section>
  )
}
