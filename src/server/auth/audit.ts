/** Append-only audit trail of the admin panel (who, what, when). Never personal data. */
import { createHmac } from 'node:crypto'

import * as schema from '../db/schema'
import type { Db } from '../scheduling/context'

export type AuditEntry = {
  actorId?: string | null
  action: string
  targetType?: string
  targetId?: string
  ip?: string | null
  data?: Record<string, string | number | boolean | null>
  now: Date
}

/** HMAC, not plain SHA-256: the IPv4 space is small enough to brute-force a bare hash. */
export const hashIdentifier = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url').slice(0, 32)

export async function audit(db: Pick<Db, 'insert'>, secret: string, entry: AuditEntry) {
  await db.insert(schema.auditLog).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    ipHash: entry.ip ? hashIdentifier(entry.ip, secret) : null,
    data: entry.data ?? {},
    createdAt: entry.now,
  })
}
