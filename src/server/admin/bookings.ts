/**
 * Bookings as the Luísa sees them in the panel. Every function here is called
 * only after `requireAdmin()` (src/server/admin/session.ts); actions are
 * re-validated on the server and written to the audit log.
 */
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'

import { decryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { audit } from '../auth/audit'
import { formatBookingCode } from '../booking/create'
import { BookingError } from '../booking/errors'
import { enqueueEmail } from '../email/enqueue'
import type { Db } from '../scheduling/context'
import { instantToLocal, minutesToTime } from '../scheduling/time'

export type BookingStatus = (typeof schema.bookingStatus.enumValues)[number]
export const STATUS_FILTERS = ['todos', ...schema.bookingStatus.enumValues] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export type AdminBookingRow = {
  id: string
  code: string
  status: BookingStatus
  customerName: string
  phone: string
  serviceName: string
  date: string
  time: string
  eventStart: string | null
  eventDuration: string | null
  totalCents: number
  expiresAt: string | null
  startsAt: string
}

export const PAGE_SIZE = 20

/** "LSR-12" / "lsr0012" / "12" → 12 when the search looks like a booking code. */
export function parseCodeSearch(q: string): number | null {
  const m = /^(?:lsr[-\s]?)?0*(\d{1,7})$/i.exec(q.trim())
  return m ? Number(m[1]) : null
}

export async function listBookings(
  db: Db,
  opts: { status: StatusFilter; q?: string; page: number },
): Promise<{ rows: AdminBookingRow[]; total: number }> {
  const where: SQL[] = []
  if (opts.status !== 'todos') where.push(eq(schema.bookings.status, opts.status))
  const q = opts.q?.trim()
  if (q) {
    const code = parseCodeSearch(q)
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    where.push(
      or(
        ilike(schema.customers.name, like),
        ilike(schema.customers.email, like),
        ...(code !== null ? [eq(schema.bookings.codeSeq, code)] : []),
      )!,
    )
  }
  const filter = where.length ? and(...where) : undefined
  // Pending first (they need action), then the next appointments, then the past.
  const order = [
    sql`case when ${schema.bookings.status} = 'pendente' then 0 else 1 end`,
    sql`case when ${schema.bookings.startsAt} >= now() then 0 else 1 end`,
    sql`case when ${schema.bookings.startsAt} >= now() then ${schema.bookings.startsAt} end asc`,
    desc(schema.bookings.startsAt),
  ]
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ b: schema.bookings, c: schema.customers })
      .from(schema.bookings)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
      .where(filter)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((Math.max(1, opts.page) - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(schema.bookings)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
      .where(filter),
  ])
  return {
    total: totalRow?.n ?? 0,
    rows: rows.map(({ b, c }) => {
      const start = instantToLocal(b.startsAt)
      return {
        id: b.id,
        code: formatBookingCode(b.codeSeq),
        status: b.status,
        customerName: c.name,
        phone: c.phoneE164,
        serviceName: b.serviceName,
        date: start.date,
        time: minutesToTime(start.minutes),
        eventStart: b.eventStartsAt ? minutesToTime(instantToLocal(b.eventStartsAt).minutes) : null,
        eventDuration: b.eventDuration,
        totalCents: b.priceCents + b.travelFeeCents,
        expiresAt: b.expiresAt?.toISOString() ?? null,
        startsAt: b.startsAt.toISOString(),
      }
    }),
  }
}

export async function countPending(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.bookings)
    .where(eq(schema.bookings.status, 'pendente'))
  return row?.n ?? 0
}

export type AdminBookingDetail = AdminBookingRow & {
  email: string
  durationMin: number
  endTime: string
  priceCents: number
  travelFeeCents: number
  travelToMin: number
  travelBackMin: number
  distanceKm: string | null
  address: string
  complement: string | null
  lookNotes: string | null
  allergyNotes: string | null
  internalNotes: string
  cancelReason: string | null
  source: string
  createdAt: string
  events: Array<{ type: string; actor: string; at: string }>
}

export async function getAdminBooking(
  db: Db,
  id: string,
  keyRing: KeyRing,
): Promise<AdminBookingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [row] = await db
    .select({ b: schema.bookings, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, id))
  if (!row) return null
  const { b, c } = row
  const dec = (v: string | null, f: string) =>
    v ? decryptField(v, keyRing, `bookings.${f}`) : null
  const events = await db
    .select()
    .from(schema.bookingEvents)
    .where(eq(schema.bookingEvents.bookingId, id))
    .orderBy(schema.bookingEvents.createdAt)
  const start = instantToLocal(b.startsAt)
  return {
    id: b.id,
    code: formatBookingCode(b.codeSeq),
    status: b.status,
    customerName: c.name,
    phone: c.phoneE164,
    email: c.email,
    serviceName: b.serviceName,
    durationMin: b.durationMin,
    date: start.date,
    time: minutesToTime(start.minutes),
    endTime: minutesToTime(instantToLocal(b.endsAt).minutes),
    eventStart: b.eventStartsAt ? minutesToTime(instantToLocal(b.eventStartsAt).minutes) : null,
    eventDuration: b.eventDuration,
    priceCents: b.priceCents,
    travelFeeCents: b.travelFeeCents,
    totalCents: b.priceCents + b.travelFeeCents,
    travelToMin: b.travelToMin,
    travelBackMin: b.travelBackMin,
    distanceKm: b.travelDistanceKm,
    address: dec(b.addressEnc, 'address') ?? '',
    complement: dec(b.complementEnc, 'complement'),
    lookNotes: dec(b.lookNotesEnc, 'look_notes'),
    allergyNotes: dec(b.allergyNotesEnc, 'allergy_notes'),
    internalNotes: dec(b.internalNotesEnc, 'internal_notes') ?? '',
    cancelReason: b.cancelReason,
    source: b.source,
    expiresAt: b.expiresAt?.toISOString() ?? null,
    startsAt: b.startsAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    events: events.map((e) => ({ type: e.type, actor: e.actor, at: e.createdAt.toISOString() })),
  }
}

type ActionDeps = { now: Date; actorId: string; secret: string; ip?: string | null }

/** Pending → confirmed. The client gets the confirmation e-mail with her link. */
export async function confirmBooking(db: Db, id: string, deps: ActionDeps): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.bookings)
      .set({ status: 'confirmado', confirmedAt: deps.now, expiresAt: null, updatedAt: deps.now })
      .where(and(eq(schema.bookings.id, id), eq(schema.bookings.status, 'pendente')))
      .returning({ id: schema.bookings.id })
    if (!updated) throw new BookingError('invalid-input', 'Este pedido não está mais pendente.')
    await tx.insert(schema.bookingEvents).values({
      bookingId: id,
      type: 'confirmed',
      actor: deps.actorId,
      data: {},
      createdAt: deps.now,
    })
    await enqueueEmail(tx, {
      kind: 'booking_confirmed',
      recipient: 'cliente',
      bookingId: id,
      dedupeKey: `booking_confirmed:cliente:${id}:${deps.now.getTime()}`,
      createdAt: deps.now,
    })
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'booking.confirmed',
      targetType: 'booking',
      targetId: id,
      ip: deps.ip,
      now: deps.now,
    })
  })
}

/** Pending → cancelled ("recusado"). Frees the slot; the client is told by e-mail. */
export async function declineBooking(
  db: Db,
  id: string,
  deps: ActionDeps & { note?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.bookings)
      .set({
        status: 'cancelado',
        cancelReason: 'recusado',
        cancelNote: deps.note?.trim().slice(0, 500) || null,
        cancelledAt: deps.now,
        expiresAt: null,
        updatedAt: deps.now,
      })
      .where(and(eq(schema.bookings.id, id), eq(schema.bookings.status, 'pendente')))
      .returning({ id: schema.bookings.id })
    if (!updated) throw new BookingError('invalid-input', 'Este pedido não está mais pendente.')
    await tx.insert(schema.bookingEvents).values({
      bookingId: id,
      type: 'declined',
      actor: deps.actorId,
      data: {},
      createdAt: deps.now,
    })
    await enqueueEmail(tx, {
      kind: 'booking_declined',
      recipient: 'cliente',
      bookingId: id,
      dedupeKey: `booking_declined:cliente:${id}`,
      createdAt: deps.now,
    })
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'booking.declined',
      targetType: 'booking',
      targetId: id,
      ip: deps.ip,
      now: deps.now,
    })
  })
}
