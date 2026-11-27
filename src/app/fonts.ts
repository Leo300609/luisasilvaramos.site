import localFont from 'next/font/local'

/** Headings. Variable font (300–700) with italic, as used by the design. */
export const cormorant = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-wght-normal.woff2', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '300 700',
  variable: '--font-cormorant',
  display: 'swap',
})

/** Body and UI text. */
export const jost = localFont({
  src: './fonts/jost-latin-wght-normal.woff2',
  weight: '300 600',
  variable: '--font-jost',
  display: 'swap',
})

/** Only for the "Desenvolvido por: Leo Almeida Canto" signature. */
export const sora = localFont({
  src: './fonts/sora-latin-600-normal.woff2',
  weight: '600',
  variable: '--font-sora',
  display: 'swap',
  preload: false,
})
