import { asc } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'

import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import * as schema from '@/server/db/schema'
import { todayLocal } from '@/server/scheduling/time'

import { NewBookingForm } from './new-booking-form'

export const metadata: Metadata = { title: 'Novo agendamento' }

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; hora?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const services = await getDb()
    .select({ id: schema.services.id, name: schema.services.name, active: schema.services.active })
    .from(schema.services)
    .orderBy(asc(schema.services.sortOrder), asc(schema.services.name))
  const date =
    params.data && /^\d{4}-\d{2}-\d{2}$/.test(params.data) ? params.data : todayLocal(new Date())
  const time = params.hora && /^\d{2}:\d{2}$/.test(params.hora) ? params.hora : '09:00'
  return (
    <div className="adm-detail">
      <Link href="/admin/agendamentos" className="adm-link adm-back">
        ‹ Voltar para a lista
      </Link>
      <p className="adm-sub">
        Para clientes que agendaram pelo WhatsApp ou pessoalmente. Entra como confirmado. Você pode
        marcar fora do horário de atendimento, mas nunca por cima de outro atendimento ou de um
        bloqueio.
      </p>
      <NewBookingForm services={services} date={date} time={time} />
    </div>
  )
}
