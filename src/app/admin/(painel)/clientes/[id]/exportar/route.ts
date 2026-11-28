import { exportCustomer } from '@/server/admin/customers'
import { authDeps, clientInfo, requireAdmin } from '@/server/admin/session'
import { getDb } from '@/server/db/client'
import { getKeyRing } from '@/server/runtime'

/** LGPD access/portability: every stored datum of one client, as a JSON download. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin()
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 })
  const data = await exportCustomer(getDb(), id, {
    now: new Date(),
    actorId: user.id,
    secret: authDeps().secret,
    ip: (await clientInfo()).ip,
    keyRing: getKeyRing(),
  })
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-cliente-${id.slice(0, 8)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
