import { StatusPage } from '@/components/status-page'
import { whatsappLink } from '@/lib/contact'

/**
 * Temporary home page (Phase 1). The real site from the design arrives in Phase 2.
 */
export default function HomePage() {
  return (
    <StatusPage
      kicker="Luísa Silva Ramos · Maquiadora profissional"
      title={
        <>
          Realce a sua <em className="text-gold-text italic">beleza</em>
        </>
      }
      description="Nosso site está sendo preparado com carinho. Enquanto isso, fale com a Luísa pelo WhatsApp para consultar datas e valores."
      action={{
        href: whatsappLink('Olá, Luísa! Vim pelo site e gostaria de saber sobre datas e valores.'),
        label: 'Chamar no WhatsApp',
        external: true,
      }}
    />
  )
}
