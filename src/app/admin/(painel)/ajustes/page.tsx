import type { Metadata } from 'next'

import { formatMoney } from '@/lib/format'
import { requireAdmin } from '@/server/admin/session'
import { listServices, loadSettings } from '@/server/admin/settings'
import { getDb } from '@/server/db/client'
import { getKeyRing } from '@/server/runtime'

import { logoutEverywhereAction } from '../actions'
import { BaseAddressForm, HoursForm, RulesForm, ServiceForm } from './settings-forms'

export const metadata: Metadata = { title: 'Ajustes' }

export default async function SettingsPage() {
  await requireAdmin()
  const db = getDb()
  const [settings, services] = await Promise.all([loadSettings(db, getKeyRing()), listServices(db)])

  return (
    <>
      <nav className="adm-seg adm-seg-wrap" aria-label="Seções dos ajustes">
        <a href="#servicos">Serviços</a>
        <a href="#horarios">Horários</a>
        <a href="#regras">Regras</a>
        <a href="#deslocamento">Deslocamento</a>
        <a href="#seguranca">Segurança</a>
      </nav>

      <section id="servicos" className="adm-panel adm-pad" aria-labelledby="h-serv">
        <h2 id="h-serv" className="adm-h2">
          Serviços e preços
        </h2>
        <p className="adm-sub">
          Mudanças valem para novos agendamentos. Os já feitos mantêm o preço e a duração da época.
          Desative um serviço para tirá-lo do site sem perder o histórico.
        </p>
        <ul className="adm-day-list">
          {services.map((s) => (
            <li key={s.id}>
              <details className="adm-disclosure">
                <summary>
                  <span className="adm-day-main">
                    <strong>{s.name}</strong>
                    <span className="adm-small">
                      {s.durationMin} min · {formatMoney(s.priceCents)}
                      {s.active ? '' : ' · desativado'}
                    </span>
                  </span>
                  <span className="adm-link">Editar</span>
                </summary>
                <ServiceForm service={s} />
              </details>
            </li>
          ))}
          <li>
            <details className="adm-disclosure">
              <summary>
                <span className="adm-day-main">
                  <strong>+ Novo serviço</strong>
                </span>
              </summary>
              <ServiceForm service={null} />
            </details>
          </li>
        </ul>
      </section>

      <section id="horarios" className="adm-panel adm-pad" aria-labelledby="h-hor">
        <h2 id="h-hor" className="adm-h2">
          Horários de atendimento
        </h2>
        <p className="adm-sub">
          O expediente inclui os deslocamentos: a saída para o primeiro atendimento e a volta do
          último cabem dentro dele.
        </p>
        <HoursForm hours={settings.hours} />
      </section>

      <section id="regras" className="adm-panel adm-pad" aria-labelledby="h-reg">
        <h2 id="h-reg" className="adm-h2">
          Regras da agenda
        </h2>
        <RulesForm rules={settings.rules} />
      </section>

      <section id="deslocamento" className="adm-panel adm-pad" aria-labelledby="h-desl">
        <h2 id="h-desl" className="adm-h2">
          Endereço de saída
        </h2>
        <p className="adm-sub">
          Usado só para calcular distância e tempo de deslocamento. Fica cifrado e nunca aparece
          para as clientes.
        </p>
        <p className="adm-note">
          {settings.baseAddress ??
            'Ainda não cadastrado: o agendamento online fica indisponível até cadastrar.'}
        </p>
        <BaseAddressForm />
      </section>

      <section id="seguranca" className="adm-panel adm-pad" aria-labelledby="h-seg">
        <h2 id="h-seg" className="adm-h2">
          Segurança
        </h2>
        <p className="adm-sub">
          Perdeu um celular ou entrou num computador que não é seu? Desconecte todos os
          dispositivos. Você vai precisar entrar de novo com senha e código.
        </p>
        <form action={logoutEverywhereAction}>
          <button type="submit" className="adm-btn adm-btn-terra">
            Sair de todos os dispositivos
          </button>
        </form>
      </section>
    </>
  )
}
