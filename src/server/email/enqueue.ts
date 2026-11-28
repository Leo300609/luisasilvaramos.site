/** Writes an e-mail to the outbox, inside the caller's transaction (see ./outbox.ts). */
import * as schema from '../db/schema'
import type { Db } from '../scheduling/context'

export const EMAIL_KINDS = [
  'booking_created',
  'booking_cancelled',
  'booking_rescheduled',
  'access_link',
  'booking_confirmed',
  'booking_declined',
  'admin_password_reset',
] as const
export type EmailKind = (typeof EMAIL_KINDS)[number]
export type Recipient = 'cliente' | 'luisa' | 'admin'

type Tx = Pick<Db, 'insert'>

export async function enqueueEmail(
  tx: Tx,
  email: {
    kind: EmailKind
    recipient: Recipient
    dedupeKey: string
    bookingId?: string
    customerId?: string
    adminUserId?: string
    data?: Record<string, string | number | boolean | null>
    notBefore?: Date
    /** Defaults to the database clock. */
    createdAt?: Date
  },
): Promise<void> {
  await tx
    .insert(schema.emailOutbox)
    .values({
      kind: email.kind,
      recipient: email.recipient,
      dedupeKey: email.dedupeKey,
      bookingId: email.bookingId ?? null,
      customerId: email.customerId ?? null,
      adminUserId: email.adminUserId ?? null,
      data: email.data ?? {},
      ...(email.notBefore ? { nextAttemptAt: email.notBefore } : {}),
      ...(email.createdAt ? { createdAt: email.createdAt } : {}),
    })
    .onConflictDoNothing({ target: schema.emailOutbox.dedupeKey })
}
