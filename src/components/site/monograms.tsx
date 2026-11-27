/** Luísa's LSR monogram (header and footer) and the developer's LAC monogram. */

type Tone = 'light' | 'dark'

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
  const ink = tone === 'light' ? '#2B1D14' : '#FBF6EE'
  const accent = tone === 'light' ? '#A67814' : '#F2B705'
  const ring = tone === 'light' ? '#C9972B' : '#F2B705'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <ellipse
        cx="32"
        cy="32"
        rx="29"
        ry="12.5"
        transform="rotate(-28 32 32)"
        stroke={ring}
        strokeWidth={tone === 'light' ? 1 : 0.9}
      />
      <text
        x="15.5"
        y="41"
        textAnchor="middle"
        fontFamily="var(--font-cormorant), Cormorant Garamond, serif"
        fontSize="24"
        fontWeight="300"
        fill={ink}
      >
        L
      </text>
      <text
        x="32"
        y="45"
        textAnchor="middle"
        fontFamily="var(--font-cormorant), Cormorant Garamond, serif"
        fontSize="36"
        fontWeight="400"
        fontStyle="italic"
        fill={accent}
      >
        S
      </text>
      <text
        x="48.5"
        y="41"
        textAnchor="middle"
        fontFamily="var(--font-cormorant), Cormorant Garamond, serif"
        fontSize="24"
        fontWeight="300"
        fill={ink}
      >
        R
      </text>
      <circle cx="57.6" cy="18.4" r="1.8" fill={ring} />
    </svg>
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
