'use client'

/**
 * Last-resort error boundary (replaces the root layout). Uses inline styles only,
 * because the global stylesheet may be what failed to load. Never a blank screen.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5EBDD',
          color: '#2B1D14',
          fontFamily: 'Georgia, serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <main>
          <h1 style={{ fontWeight: 300, fontSize: '40px', margin: '0 0 16px' }}>
            Estamos com uma instabilidade
          </h1>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#6B5444', margin: '0 0 24px' }}>
            Tente de novo em alguns instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '48px',
              padding: '0 32px',
              border: 0,
              borderRadius: '999px',
              background: '#F2B705',
              color: '#2B1D14',
              fontSize: '14px',
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            TENTAR DE NOVO
          </button>
        </main>
      </body>
    </html>
  )
}
