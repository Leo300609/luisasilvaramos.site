import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ImageResponse } from 'next/og'

export const alt = 'Luísa Silva Ramos · Maquiadora Profissional · Realce a sua beleza'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Social sharing card (WhatsApp, Instagram, Facebook), generated at build time. */
export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), 'src/assets/logo/logo-terra.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '80px 88px',
        background:
          'radial-gradient(circle at 82% 30%, rgba(248,222,126,.75) 0%, rgba(248,222,126,0) 55%), #F5EBDD',
        color: '#2B1D14',
        fontFamily: 'serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 24,
            letterSpacing: 8,
            color: '#7A5A12',
          }}
        >
          <div style={{ width: 56, height: 2, background: '#C9972B' }} />
          LUÍSA SILVA RAMOS
        </div>
        <div style={{ marginTop: 36, fontSize: 92, lineHeight: 1, letterSpacing: 4 }}>
          REALCE A SUA
        </div>
        <div style={{ fontSize: 120, lineHeight: 1.05, fontStyle: 'italic', color: '#A67814' }}>
          beleza
        </div>
        <div style={{ marginTop: 32, fontSize: 30, letterSpacing: 10 }}>MAQUIAGEM PROFISSIONAL</div>
      </div>
      <img src={logoSrc} width={360} height={276} alt="" />
    </div>,
    size,
  )
}
