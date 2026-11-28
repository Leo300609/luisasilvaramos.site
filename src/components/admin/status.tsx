import type { BookingStatus } from '@/server/admin/bookings'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <span className={`adm-chip is-${status}`}>
      <span aria-hidden="true" className="adm-chip-dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}
