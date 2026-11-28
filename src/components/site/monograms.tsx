/** Luísa's logo and LSR monogram, and the developer's LAC monogram. */

import Image from 'next/image'

import logoDourada from '@/assets/logo/logo-dourada.png'
import logoTerra from '@/assets/logo/logo-terra.png'
import monogramaDourado from '@/assets/logo/monograma-dourado.png'
import monogramaTerra from '@/assets/logo/monograma-terra.png'

type Tone = 'light' | 'dark'

/**
 * Luísa's LSR monogram, from her logo, recoloured to the site palette:
 * gold-text on light backgrounds, gold on espresso. `size` is the height in px.
 */
export function LsrMonogram({
  size,
  tone = 'light',
  title,
}: {
  size: number
  tone?: Tone
  /** When set, the monogram is announced; otherwise it is decorative. */
  title?: string
}) {
  const src = tone === 'light' ? monogramaTerra : monogramaDourado
  return (
    <Image
      src={src}
      alt={title ?? ''}
      height={size}
      width={Math.round((size * src.width) / src.height)}
      style={{ maxWidth: '100%', height: 'auto' }}
      {...(title ? {} : { 'aria-hidden': true })}
    />
  )
}

/** The full logo (ornaments, monogram and name). `width` in px. */
export function LsrLogo({
  width,
  tone = 'light',
  priority = false,
}: {
  width: number
  tone?: Tone
  priority?: boolean
}) {
  const src = tone === 'light' ? logoTerra : logoDourada
  return (
    <Image
      src={src}
      alt="Luísa Silva Ramos"
      width={width}
      height={Math.round((width * src.height) / src.width)}
      style={{ maxWidth: '100%', height: 'auto' }}
      priority={priority}
    />
  )
}

/** "Leo Almeida Canto" monogram, dark variant (used on the espresso footer). */
export function LacMonogram({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M95.2 30.4 A46 46 0 1 0 95.2 89.6" stroke="#C9972B" strokeWidth="8" />
      <path d="M40 34 V82 H52 L68 34 L84 82" stroke="#F5EBDD" strokeWidth="8" />
      <circle cx="68" cy="66" r="4.6" fill="#C9972B" stroke="none" />
    </svg>
  )
}
