/**
 * Client-side management of a booking through its secret link ("Minha agenda").
 * Every rule is enforced here, on the server: the cancellation window, the
 * revalidated availability for rescheduling and the status transitions.
 */
import { and, eq, sql } from 'drizzle-orm'

import { decryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { enqueueEmail } from '../email/enqueue'
import { getDaySlots, loadConfig, type Db } from '../scheduling/context'
import { addMinutes, instantToLocal, localToInstant, minutesToTime } from '../scheduling/time'
import { formatBookingCode } from './create'
import { BookingError } from './errors'
import { revokeTokens } from './tokens'

const AGENDA_LOCK_KEY = 4_157_002

export type ClientBookingView = {
  id: string
  code: string
  status: (typeof schema.bookingStatus.enumValues)[number]
  serviceName: string
  durationMin: number
  date: string
  time: string
  endTime: string
  startsAt: string
  endsAt: string
  eventStart: string | null
  eventDuration: string | null
  priceCents: number
  travelFeeCents: number
  totalCents: number
  address: string
  complement: string | null
  lookNotes: string | null
  customer: { name: string; phone: string; email: string }
  /** Whether the client may still cancel/reschedule online (policy window). */
  canChange: boolean
  changeDeadline: string
}

export async function getClientBooking(
  db: Db,
  bookingId: string,
  deps: { keyRing: KeyRing; now: Date },
): Promise<ClientBookingView | null> {
  const [row] = await db
    .select({ b: schema.bookings, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, bookingId))
  if (!row) return null
  const { b, c } = row
  const config = await loadConfig(db)
  const deadline = addMinutes(b.startsAt, -config.cancelWindowHours * 60)
  const start = instantToLocal(b.startsAt)
  const end = instantToLocal(b.endsAt)
  const dec = (v: string | null, f: string) =>
    v ? decryptField(v, deps.keyRing, `bookings.${f}`) : null
  return {
    id: b.id,
    code: formatBookingCode(b.codeSeq),
    status: b.status,
    serviceName: b.serviceName,
    durationMin: b.durationMin,
    date: start.date,
    time: minutesToTime(start.minutes),
    endTime: minutesToTime(end.minutes),
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    eventStart: b.eventStartsAt ? minutesToTime(instantToLocal(b.eventStartsAt).minutes) : null,
    eventDuration: b.eventDuration,
    priceCents: b.priceCents,
    travelFeeCents: b.travelFeeCents,
    totalCents: b.priceCents + b.travelFeeCents,
    address: dec(b.addressEnc, 'address') ?? '',
    complement: dec(b.complementEnc, 'complement'),
    lookNotes: dec(b.lookNotesEnc, 'look_notes'),
    customer: { name: c.name, phone: c.phoneE164, email: c.email },
    canChange: ['pendente', 'confirmado'].includes(b.status) && deps.now < deadline,
    changeDeadline: deadline.toISOString(),
  }
}

async function loadActive(db: Db, bookingId: string, now: Date, windowHours: number) {
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (!b || !['pendente', 'confirmado'].includes(b.status)) {
    throw new BookingError('invalid-input', 'Este agendamento não pode mais ser alterado.')
  }
  if (now >= addMinutes(b.startsAt, -windowHours * 60)) {
    throw new BookingError(
      'outside-window',
      `Alterações online só até ${windowHours} horas antes. Fale com a Luísa pelo WhatsApp.`,
    )
  }
  return b
}

export async function cancelByClient(
  db: Db,
  bookingId: string,
  deps: { now: Date },
): Promise<void> {
  const config = await loadConfig(db)
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${AGENDA_LOCK_KEY})`)
    await loadActive(tx, bookingId, deps.now, config.cancelWindowHours)
    await tx
      .update(schema.bookings)
      .set({ status: 'cancelado', cancelReason: 'pedido_cliente', cancelledAt: deps.now })
      .where(eq(schema.bookings.id, bookingId))
    await tx
      .insert(schema.bookingEvents)
      .values({ bookingId, type: 'cancelled', actor: 'cliente', data: {} })
    for (const recipient of ['cliente', 'luisa'] as const) {
      await enqueueEmail(tx, {
        kind: 'booking_cancelled',
        recipient,
        bookingId,
        dedupeKey: `booking_cancelled:${recipient}:${bookingId}`,
        createdAt: deps.now,
      })
    }
  })
}

export async function slotsForReschedule(
  db: Db,
  bookingId: string,
  date: string,
  deps: { now: Date },
) {
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (!b) return []
  return getDaySlots(db, {
    date,
    now: deps.now,
    durationMin: b.durationMin,
    travel: { toMin: b.travelToMin, backMin: b.travelBackMin },
    excludeBookingId: bookingId,
    // The event moves with the booking only if it is on the same day; otherwise no rule.
    ...(b.eventStartsAt && instantToLocal(b.eventStartsAt).date === date
      ? { eventStart: minutesToTime(instantToLocal(b.eventStartsAt).minutes) }
      : {}),
  })
}

/**
 * Moves the booking to another slot. The old range is released in the same
 * statement (EXCLUDE ignores the row being updated against itself).
 */
export async function rescheduleByClient(
  db: Db,
  bookingId: string,
  target: { date: string; time: string; eventStart?: string },
  deps: { now: Date },
): Promise<void> {
  const config = await loadConfig(db)
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${AGENDA_LOCK_KEY})`)
      const b = await loadActive(tx, bookingId, deps.now, config.cancelWindowHours)
      const slots = await getDaySlots(
        tx,
        {
          date: target.date,
          now: deps.now,
          durationMin: b.durationMin,
          travel: { toMin: b.travelToMin, backMin: b.travelBackMin },
          excludeBookingId: b.id,
          ...(target.eventStart ? { eventStart: target.eventStart } : {}),
        },
        config,
      )
      const slot = slots.find((s) => s.time === target.time)
      if (!slot) throw new BookingError('slot-taken', 'Esse horário acabou de ser reservado.')
      const [h, m] = (target.eventStart ?? '').split(':').map(Number)
      await tx
        .update(schema.bookings)
        .set({
          startsAt: slot.start,
          endsAt: slot.end,
          // A reschedule goes back to "pendente" when the Luísa confirms manually.
          status: config.manualConfirmation ? 'pendente' : b.status,
          ...(target.eventStart
            ? { eventStartsAt: localToInstant(target.date, (h ?? 0) * 60 + (m ?? 0)) }
            : {}),
        })
        .where(and(eq(schema.bookings.id, b.id)))
      await tx.insert(schema.bookingEvents).values({
        bookingId: b.id,
        type: 'rescheduled',
        actor: 'cliente',
        data: { from: b.startsAt.toISOString(), to: slot.start.toISOString() },
      })
      for (const recipient of ['cliente', 'luisa'] as const) {
        await enqueueEmail(tx, {
          kind: 'booking_rescheduled',
          recipient,
          bookingId: b.id,
          dedupeKey: `booking_rescheduled:${recipient}:${b.id}:${deps.now.getTime()}`,
          data: { from: b.startsAt.toISOString() },
          createdAt: deps.now,
        })
      }
    })
  } catch (error) {
    const code = error as { code?: string; cause?: { code?: string } }
    if (code.code === '23P01' || code.cause?.code === '23P01') {
      throw new BookingError('slot-taken', 'Esse horário acabou de ser reservado.')
    }
    throw error
  }
}

export { revokeTokens }
