import type { SVGProps } from 'react'

/** Line icons drawn in the design (stroke, 24×24). Decorative unless a label is given. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const ArrowRight = (p: IconProps) => (
  <Svg strokeWidth={1.5} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)
export const ChevronLeft = (p: IconProps) => (
  <Svg strokeWidth={1.5} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)
export const ChevronRight = (p: IconProps) => (
  <Svg strokeWidth={1.5} {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)
export const Close = (p: IconProps) => (
  <Svg strokeWidth={1.5} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const WhatsApp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.6a8.2 8.2 0 0 1-12.1 7.2L3.5 20l1.2-4.2A8.2 8.2 0 1 1 20 11.6z" />
    <path d="M9 8.8c.2 3 2.8 5.7 6 6l1-1.5-2-1-1 .7a4 4 0 0 1-2.2-2.2l.7-1-1-2z" />
  </Svg>
)
export const Instagram = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
  </Svg>
)
export const Mail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
)
export const MapPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
)
export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const Person = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </Svg>
)
export const Sparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5C12.6 7.6 16.4 11.4 21.5 12 16.4 12.6 12.6 16.4 12 21.5 11.4 16.4 7.6 12.6 2.5 12 7.6 11.4 11.4 7.6 12 2.5Z" />
  </Svg>
)
export const Camera = (p: IconProps) => (
  <Svg strokeWidth={1.2} {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7l1.5-3h5L16 7" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Svg>
)
export const Eye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
export const CheckCircle = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.6 2.5L16 9.5" />
  </Svg>
)
export const Alert = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </Svg>
)
export const Avatar = (p: IconProps) => (
  <Svg strokeWidth={1.3} {...p}>
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5.5 19c.8-3 3.4-4.5 6.5-4.5s5.7 1.5 6.5 4.5" />
  </Svg>
)

export const ServiceIcon = ({ name, ...p }: IconProps & { name: string }) => (
  <Svg strokeWidth={1.2} {...p}>
    {name === 'social' && (
      <>
        <path d="M9 21h6V12H9z" />
        <path d="M10 12V6.5L14 4v8" />
        <path d="M9 16h6" />
      </>
    )}
    {name === 'noiva' && (
      <>
        <circle cx="12" cy="15" r="6" />
        <path d="M9.5 5.5L12 3l2.5 2.5L12 8z" />
      </>
    )}
    {name === 'formatura' && (
      <>
        <path d="M2 9l10-5 10 5-10 5z" />
        <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
        <path d="M22 9v6" />
      </>
    )}
    {name === 'eventos' && (
      <>
        <path d="M7 3h10l-1 7a4 4 0 0 1-8 0z" />
        <path d="M12 14v7" />
        <path d="M8 21h8" />
        <path d="M8 6.5h8" />
      </>
    )}
  </Svg>
)

const STAR =
  'M12 0C12.8 7 17 11.2 24 12 17 12.8 12.8 17 12 24 11.2 17 7 12.8 0 12 7 11.2 11.2 7 12 0Z'

/** Four-point twinkle used as decoration around the hero, about and CTA. */
export function Twinkle({
  size,
  color,
  opacity,
  className,
}: {
  size: number
  color: string
  opacity?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={STAR} fill={color} fillOpacity={opacity} />
    </svg>
  )
}

export function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="lsr-stars" role="img" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: count }, (_, i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
        </svg>
      ))}
    </div>
  )
}
