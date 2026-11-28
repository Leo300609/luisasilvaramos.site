/** Line icons of the admin canvas (1.4–1.6 stroke, 24px grid). Decorative. */

type IconProps = { size?: number; className?: string }

function Icon({
  size = 22,
  className,
  children,
  strokeWidth = 1.5,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </Icon>
)
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
)
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={1.7}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.6 2.5L16 9.5" />
  </Icon>
)
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={1.4}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
)
export const EyeIcon = ({ slashed, ...p }: IconProps & { slashed?: boolean }) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {slashed && <path d="M4 4l16 16" />}
  </Icon>
)
export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)
export const Spinner = () => (
  <svg
    className="adm-spin"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="rgba(43,29,20,.25)" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="#2B1D14" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)
