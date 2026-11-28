import { redirect } from 'next/navigation'

/** The dashboard arrives in Phase 5b; until then the panel opens on the bookings list. */
export default function AdminHome() {
  redirect('/admin/agendamentos')
}
