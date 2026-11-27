import Link from 'next/link'
import type { ReactNode } from 'react'

type Action = { href: string; label: string; external?: boolean }

type StatusPageProps = {
  kicker: string
  title: ReactNode
  description: string
  action?: Action
  secondary?: Action
  /** Extra content under the description (e.g. a small form). */
  children?: ReactNode
}

const primaryClass =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-8 text-sm font-medium tracking-[0.14em] text-espresso uppercase transition hover:-translate-y-0.5 hover:bg-butter hover:shadow-[0_14px_30px_-12px_rgba(201,151,43,.65)]'
const secondaryClass =
  'inline-flex min-h-12 items-center justify-center text-sm font-medium tracking-[0.14em] text-gold-text uppercase underline-offset-4 hover:text-espresso hover:underline'

function ActionLink({ action, className }: { action: Action; className: string }) {
  if (action.external) {
    return (
      <a href={action.href} className={className} target="_blank" rel="noopener noreferrer">
        {action.label}
      </a>
    )
  }
  return (
    // Status pages link only to known internal routes.
    <Link href={action.href as '/'} className={className}>
      {action.label}
    </Link>
  )
}

/**
 * Simple full-screen message in the site's visual language. Used by the
 * temporary home, 404 and error pages (design gap L6).
 */
export function StatusPage({
  kicker,
  title,
  description,
  action,
  secondary,
  children,
}: StatusPageProps) {
  return (
    <main
      id="conteudo"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-24 tablet:px-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-40 size-[520px] rounded-[58%_42%_55%_45%/46%_52%_48%_54%] bg-butter/45 blur-2xl"
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <p className="flex items-center gap-3 text-xs font-medium tracking-[0.28em] text-gold-text uppercase">
          <span aria-hidden="true" className="hidden h-px w-8 bg-gold-burnt tablet:block" />
          {kicker}
          <span aria-hidden="true" className="hidden h-px w-8 bg-gold-burnt tablet:block" />
        </p>
        <h1 className="font-display text-5xl leading-[1.05] font-light text-espresso tablet:text-7xl">
          {title}
        </h1>
        <p className="max-w-xl text-lg leading-relaxed font-light text-brown">{description}</p>
        {children}
        {(action ?? secondary) && (
          <div className="mt-2 flex flex-col items-center gap-4 tablet:flex-row tablet:gap-8">
            {action && <ActionLink action={action} className={primaryClass} />}
            {secondary && <ActionLink action={secondary} className={secondaryClass} />}
          </div>
        )}
      </div>
    </main>
  )
}
