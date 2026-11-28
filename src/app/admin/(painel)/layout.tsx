import { AdminShell } from '@/components/admin/shell'
import { countPending } from '@/server/admin/bookings'
import { requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'

import { logoutAction, logoutEverywhereAction } from './actions'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  const pending = await countPending(getDb())
  return (
    <AdminShell
      user={{ name: user.name }}
      pending={pending}
      logout={logoutAction}
      logoutEverywhere={logoutEverywhereAction}
    >
      {children}
    </AdminShell>
  )
}
