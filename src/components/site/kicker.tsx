/** Section kicker: small uppercase label with the golden hairline(s). */
export function Kicker({ children, centered }: { children: string; centered?: boolean }) {
  return <p className={`lsr-kicker m-0 ${centered ? 'is-centered' : ''}`}>{children}</p>
}
