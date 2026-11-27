'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The server already logged the details (instrumentation.ts). Only the digest helps support.
    if (error.digest) console.error('Erro de servidor, código:', error.digest)
  }, [error.digest])

  return (
    <main
      id="conteudo"
      className="flex min-h-dvh items-center justify-center px-5 py-24 text-center tablet:px-10"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
        <p className="text-xs font-medium tracking-[0.28em] text-gold-text uppercase">
          Algo deu errado
        </p>
        <h1 className="font-display text-5xl leading-tight font-light tablet:text-6xl">
          Não conseguimos carregar esta página
        </h1>
        <p className="text-lg font-light text-brown">
          Pode ter sido uma instabilidade momentânea. Tente de novo em alguns instantes.
          {error.digest ? ` Código do erro: ${error.digest}.` : ''}
        </p>
        <div className="flex flex-col items-center gap-4 tablet:flex-row tablet:gap-8">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-8 text-sm font-medium tracking-[0.14em] text-espresso uppercase transition hover:bg-butter"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center text-sm font-medium tracking-[0.14em] text-gold-text uppercase hover:text-espresso"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  )
}
