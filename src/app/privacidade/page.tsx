import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteFooter } from '@/components/site/footer'
import { SiteHeader } from '@/components/site/header'
import { CONTACT, whatsappLink } from '@/lib/contact'

import '../site.css'

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Como a Luísa Silva Ramos trata os seus dados pessoais (LGPD).',
  alternates: { canonical: '/privacidade' },
}

/**
 * Privacy notice (LGPD art. 9). Describes what the system actually does; the
 * text must be reviewed by a lawyer before go-live (docs/go-live-checklist.md).
 * TODO(Leo): incluir CNPJ/MEI da controladora quando existir (risco R6.1).
 */
const UPDATED = '28 de novembro de 2026'

export default function PrivacyPage() {
  return (
    <div className="lsr">
      <SiteHeader />
      <main id="conteudo" className="lsr-legal">
        <article className="lsr-container lsr-legal-body">
          <p className="lsr-legal-kicker">LGPD · Lei 13.709/2018</p>
          <h1>Política de privacidade</h1>
          <p className="lsr-legal-updated">Atualizada em {UPDATED}.</p>

          <p>
            Esta página explica, em linguagem simples, quais dados pessoais são usados quando você
            agenda uma maquiagem pelo site, para quê, por quanto tempo e quais são os seus direitos.
          </p>

          <h2>Quem cuida dos seus dados</h2>
          <p>
            A controladora é <strong>Luísa Silva Ramos</strong>, maquiadora profissional que atende
            em Suzano e no Alto Tietê. Para qualquer assunto sobre os seus dados, fale direto com
            ela pelo e-mail <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> ou pelo{' '}
            <a href={whatsappLink('Olá, Luísa! Tenho uma dúvida sobre os meus dados.')}>WhatsApp</a>
            .
          </p>

          <h2>Quais dados usamos e para quê</h2>
          <ul>
            <li>
              <strong>Nome, WhatsApp e e-mail:</strong> para confirmar o agendamento, mandar o link
              da “Minha agenda”, lembretes e avisos de mudança. Base legal: procedimentos para a
              prestação do serviço que você pediu (art. 7º, V).
            </li>
            <li>
              <strong>Endereço do atendimento:</strong> a maquiagem é feita no local que você
              indica; o endereço também serve para calcular a taxa e o tempo de deslocamento. Mesma
              base legal.
            </li>
            <li>
              <strong>Horário e duração do evento e observações sobre o look:</strong> para sugerir
              o melhor horário e preparar o atendimento.
            </li>
            <li>
              <strong>Alergias e sensibilidades (dado de saúde):</strong> só se você quiser
              informar, e apenas com o seu consentimento expresso, marcado no formulário (art. 11,
              I). Servem para escolher produtos seguros para a sua pele.
            </li>
            <li>
              <strong>Dados técnicos de segurança:</strong> o endereço IP é transformado num código
              irreversível (não guardamos o IP) e usado só para limitar abusos, como tentativas
              repetidas. Base legal: legítimo interesse em manter o serviço seguro (art. 7º, IX).
            </li>
          </ul>
          <p>
            Não usamos os seus dados para publicidade, não vendemos nem compartilhamos com terceiros
            para marketing e não usamos cookies de rastreamento. O único cookie é o da “Minha
            agenda”, que mantém o acesso ao seu agendamento neste navegador.
          </p>

          <h2>Com quem os dados são compartilhados</h2>
          <p>
            Só com os serviços que fazem o site funcionar, que tratam os dados em nosso nome e
            seguindo as nossas instruções:
          </p>
          <ul>
            <li>Netlify (hospedagem do site), nos Estados Unidos;</li>
            <li>Neon (banco de dados), nos Estados Unidos;</li>
            <li>Resend (envio dos e-mails do agendamento), nos Estados Unidos;</li>
            <li>BrasilAPI (consulta do CEP; recebe apenas o CEP digitado).</li>
          </ul>
          <p>
            Por isso há transferência internacional de dados, feita com fornecedores que adotam
            garantias de segurança compatíveis com a LGPD (art. 33).
          </p>

          <h2>Por quanto tempo</h2>
          <ul>
            <li>
              <strong>Alergias e sensibilidades:</strong> apagadas automaticamente 30 dias depois do
              atendimento.
            </li>
            <li>
              <strong>Cadastro e histórico:</strong> enquanto você for cliente. Depois de 2 anos sem
              nenhum atendimento, nome, contatos, endereços e observações são apagados
              automaticamente. Ficam só data, serviço e valor, sem identificar você, para fins
              contábeis.
            </li>
            <li>
              <strong>Registros de segurança:</strong> no máximo o tempo exigido por lei para
              registros de acesso.
            </li>
          </ul>

          <h2>Como protegemos</h2>
          <p>
            Endereços, observações e alergias ficam cifrados no banco de dados. O painel da Luísa
            exige senha e um código do celular (verificação em 2 etapas), e cada acesso fica
            registrado. Os links da “Minha agenda” são secretos e só você os recebe.
          </p>

          <h2>Seus direitos</h2>
          <p>Você pode, a qualquer momento e sem custo:</p>
          <ul>
            <li>confirmar se tratamos dados seus e receber uma cópia deles;</li>
            <li>corrigir dados incompletos ou desatualizados;</li>
            <li>pedir que os seus dados sejam apagados;</li>
            <li>retirar o consentimento sobre as alergias (elas são apagadas na hora);</li>
            <li>tirar dúvidas sobre como os seus dados são usados.</li>
          </ul>
          <p>
            Basta escrever para <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. A resposta
            sai em até 15 dias. Se não ficar satisfeita, você também pode procurar a Autoridade
            Nacional de Proteção de Dados (ANPD).
          </p>

          <h2>Mudanças nesta política</h2>
          <p>
            Se algo mudar, esta página é atualizada e a data no topo muda junto. Mudanças
            importantes também são avisadas a quem tem agendamento ativo.
          </p>

          <p className="lsr-legal-back">
            <Link href="/">Voltar ao site</Link> · <Link href="/agendar">Agendar</Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
