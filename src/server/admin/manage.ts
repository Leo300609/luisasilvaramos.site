/**
 * What the Luísa can do to the agenda from the panel. Unlike the public flow,
 * she may book outside opening hours or with short notice (it is her agenda),
 * but never on top of another appointment (the EXCLUDE constraint) or a block.
 */
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { decryptField, encryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { audit } from '../auth/audit'
import { formatBookingCode } from '../booking/create'
import { BookingError } from '../booking/errors'
import { normalizeBrazilianPhone } from '../booking/phone'
import { enqueueEmail } from '../email/enqueue'
import type { Db } from '../scheduling/context'
import { addMinutes, localToInstant, timeToMinutes } from '../scheduling/time'

const AGENDA_LOCK_KEY = 4_157_002

export type ActorDeps = { now: Date; actorId: string; secret: string; ip?: string | null }

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const pgCode = (error: unknown): string | undefined => {
  const e = error as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}

async function assertNoBlock(tx: Tx | Db, start: Date, end: Date) {
  const [hit] = await tx
    .select({ id: schema.blocks.id })
    .from(schema.blocks)
    .where(and(lt(schema.blocks.startsAt, end), gt(schema.blocks.endsAt, start)))
    .limit(1)
  if (hit) throw new BookingError('slot-taken', 'Esse horário está bloqueado na agenda.')
}

async function hasClientEmail(tx: Tx, bookingId: string): Promise<boolean> {
  const [row] = await tx
    .select({ email: schema.customers.email })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, bookingId))
  return Boolean(row?.email)
}

async function logEvent(tx: Tx, bookingId: string, type: string, deps: ActorDeps, data = {}) {
  await tx.insert(schema.bookingEvents).values({
    bookingId,
    type,
    actor: deps.actorId,
    data,
    createdAt: deps.now,
  })
  await audit(tx, deps.secret, {
    actorId: deps.actorId,
    action: `booking.${type}`,
    targetType: 'booking',
    targetId: bookingId,
    ip: deps.ip,
    now: deps.now,
  })
}

// ── New booking from the panel ──────────────────────────────────────────────

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const adminBookingSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time,
  eventStart: time.optional(),
  eventDuration: z.enum(schema.eventDuration.enumValues).optional(),
  customer: z.object({
    name: z.string().trim().min(3).max(120),
    phone: z.string().trim().min(10).max(20),
    email: z.union([z.literal(''), z.email().max(200)]),
  }),
  address: z.string().trim().min(5).max(300),
  complement: z.string().trim().max(200).optional(),
  travel: z.object({
    feeCents: z.number().int().min(0).max(1_000_000),
    toMin: z.number().int().min(0).max(480),
    backMin: z.number().int().min(0).max(480),
    distanceKm: z.number().min(0).max(1000).nullable(),
  }),
  /** Price override (e.g. a package); defaults to the service price. */
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  notes: z.string().trim().max(1000).optional(),
})
export type AdminBookingInput = z.input<typeof adminBookingSchema>

export async function createBookingFromPanel(
  db: Db,
  raw: AdminBookingInput,
  deps: ActorDeps & { keyRing: KeyRing },
): Promise<{ id: string; code: string }> {
  const input = adminBookingSchema.parse(raw)
  const phone = normalizeBrazilianPhone(input.customer.phone)
  if (!phone) throw new BookingError('invalid-input', 'Telefone inválido.')
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${AGENDA_LOCK_KEY})`)
      const [service] = await tx
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, input.serviceId))
      if (!service) throw new BookingError('service-unavailable', 'Serviço não encontrado.')
      const [buffer] = await tx
        .select({ bufferMin: schema.scheduleSettings.bufferMin })
        .from(schema.scheduleSettings)
      const startsAt = localToInstant(input.date, timeToMinutes(input.time))
      const endsAt = addMinutes(startsAt, service.durationMin)
      await assertNoBlock(
        tx,
        addMinutes(startsAt, -input.travel.toMin),
        addMinutes(endsAt, input.travel.backMin + (buffer?.bufferMin ?? 0)),
      )

      const email = input.customer.email.toLowerCase()
      const [customer] = await tx
        .insert(schema.customers)
        .values({ name: input.customer.name, phoneE164: phone, email, createdAt: deps.now })
        .onConflictDoUpdate({
          target: schema.customers.phoneE164,
          targetWhere: sql`${schema.customers.anonymizedAt} is null`,
          set: {
            name: input.customer.name,
            ...(email ? { email } : {}),
            updatedAt: deps.now,
          },
        })
        .returning({ id: schema.customers.id })
      const enc = (v: string | undefined, f: string) =>
        v ? encryptField(v, deps.keyRing, `bookings.${f}`) : null
      const [row] = await tx
        .insert(schema.bookings)
        .values({
          customerId: customer!.id,
          serviceId: service.id,
          serviceName: service.name,
          durationMin: service.durationMin,
          priceCents: input.priceCents ?? service.priceCents,
          travelFeeCents: input.travel.feeCents,
          travelToMin: input.travel.toMin,
          travelBackMin: input.travel.backMin,
          travelDistanceKm: input.travel.distanceKm?.toFixed(1) ?? null,
          bufferMin: buffer?.bufferMin ?? 0,
          startsAt,
          endsAt,
          eventStartsAt: input.eventStart
            ? localToInstant(input.date, timeToMinutes(input.eventStart))
            : null,
          eventDuration: input.eventDuration ?? null,
          addressEnc: enc(input.address, 'address')!,
          complementEnc: enc(input.complement, 'complement'),
          internalNotesEnc: enc(input.notes, 'internal_notes'),
          status: 'confirmado',
          source: 'admin',
          confirmedAt: deps.now,
          createdAt: deps.now,
          updatedAt: deps.now,
        })
        .returning({ id: schema.bookings.id, codeSeq: schema.bookings.codeSeq })
      await logEvent(tx, row!.id, 'created_by_admin', deps)
      if (email) {
        await enqueueEmail(tx, {
          kind: 'booking_confirmed',
          recipient: 'cliente',
          bookingId: row!.id,
          dedupeKey: `booking_confirmed:cliente:${row!.id}:${deps.now.getTime()}`,
          createdAt: deps.now,
        })
      }
      return { id: row!.id, code: formatBookingCode(row!.codeSeq) }
    })
  } catch (error) {
    if (pgCode(error) === '23P01') {
      throw new BookingError('slot-taken', 'Esse horário conflita com outro atendimento.')
    }
    throw error
  }
}

// ── Changes to an existing booking ──────────────────────────────────────────

export async function rescheduleFromPanel(
  db: Db,
  bookingId: string,
  target: { date: string; time: string; eventStart?: string; notify: boolean },
  deps: ActorDeps,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${AGENDA_LOCK_KEY})`)
      const [b] = await tx.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
      if (!b || !['pendente', 'confirmado'].includes(b.status)) {
        throw new BookingError('invalid-input', 'Só dá para remarcar agendamentos ativos.')
      }
      const startsAt = localToInstant(target.date, timeToMinutes(target.time))
      const endsAt = addMinutes(startsAt, b.durationMin)
      await assertNoBlock(
        tx,
        addMinutes(startsAt, -b.travelToMin),
        addMinutes(endsAt, b.travelBackMin + b.bufferMin),
      )
      await tx
        .update(schema.bookings)
        .set({
          startsAt,
          endsAt,
          ...(target.eventStart
            ? { eventStartsAt: localToInstant(target.date, timeToMinutes(target.eventStart)) }
            : {}),
          updatedAt: deps.now,
        })
        .where(eq(schema.bookings.id, bookingId))
      await logEvent(tx, bookingId, 'rescheduled_by_admin', deps, {
        from: b.startsAt.toISOString(),
        to: startsAt.toISOString(),
      })
      if (target.notify && (await hasClientEmail(tx, bookingId))) {
        await enqueueEmail(tx, {
          kind: 'booking_rescheduled',
          recipient: 'cliente',
          bookingId,
          dedupeKey: `booking_rescheduled:cliente:${bookingId}:${deps.now.getTime()}`,
          data: { from: b.startsAt.toISOString() },
          createdAt: deps.now,
        })
      }
    })
  } catch (error) {
    if (pgCode(error) === '23P01') {
      throw new BookingError('slot-taken', 'Esse horário conflita com outro atendimento.')
    }
    throw error
  }
}

export const ADMIN_CANCEL_REASONS = ['imprevisto_maquiadora', 'pedido_cliente', 'outro'] as const

export async function cancelFromPanel(
  db: Db,
  bookingId: string,
  opts: { reason: (typeof ADMIN_CANCEL_REASONS)[number]; note?: string; notify: boolean },
  deps: ActorDeps,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.bookings)
      .set({
        status: 'cancelado',
        cancelReason: opts.reason,
        cancelNote: opts.note?.trim().slice(0, 500) || null,
        cancelledAt: deps.now,
        expiresAt: null,
        updatedAt: deps.now,
      })
      .where(
        and(
          eq(schema.bookings.id, bookingId),
          sql`${schema.bookings.status} in ('pendente', 'confirmado')`,
        ),
      )
      .returning({ id: schema.bookings.id })
    if (!updated) throw new BookingError('invalid-input', 'Este agendamento não está ativo.')
    await logEvent(tx, bookingId, 'cancelled_by_admin', deps, { reason: opts.reason })
    if (opts.notify && (await hasClientEmail(tx, bookingId))) {
      await enqueueEmail(tx, {
        kind: 'booking_cancelled',
        recipient: 'cliente',
        bookingId,
        dedupeKey: `booking_cancelled:cliente:${bookingId}`,
        createdAt: deps.now,
      })
    }
  })
}

/** After the appointment: done, or the client did not show up. */
export async function closeFromPanel(
  db: Db,
  bookingId: string,
  outcome: 'concluido' | 'nao_compareceu',
  deps: ActorDeps,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.bookings)
      .set(
        outcome === 'concluido'
          ? { status: 'concluido', completedAt: deps.now, updatedAt: deps.now }
          : {
              status: 'cancelado',
              cancelReason: 'nao_compareceu',
              cancelledAt: deps.now,
              updatedAt: deps.now,
            },
      )
      .where(
        and(
          eq(schema.bookings.id, bookingId),
          eq(schema.bookings.status, 'confirmado'),
          lt(schema.bookings.startsAt, deps.now),
        ),
      )
      .returning({ id: schema.bookings.id })
    if (!updated) {
      throw new BookingError(
        'invalid-input',
        'Só dá para encerrar um agendamento confirmado depois do horário marcado.',
      )
    }
    await logEvent(tx, bookingId, outcome === 'concluido' ? 'completed' : 'no_show', deps)
  })
}

export async function saveInternalNotes(
  db: Db,
  bookingId: string,
  notes: string,
  deps: ActorDeps & { keyRing: KeyRing },
): Promise<void> {
  const text = notes.trim().slice(0, 2000)
  await db.transaction(async (tx) => {
    await tx
      .update(schema.bookings)
      .set({
        internalNotesEnc: text ? encryptField(text, deps.keyRing, 'bookings.internal_notes') : null,
        updatedAt: deps.now,
      })
      .where(eq(schema.bookings.id, bookingId))
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'booking.notes_saved',
      targetType: 'booking',
      targetId: bookingId,
      ip: deps.ip,
      now: deps.now,
    })
  })
}

export function readInternalNotes(enc: string | null, keyRing: KeyRing): string {
  return enc ? decryptField(enc, keyRing, 'bookings.internal_notes') : ''
}

// ── Blocks (vacation, personal appointments) ────────────────────────────────

export const blockSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    allDay: z.boolean(),
    start: time.optional(),
    end: time.optional(),
    reason: z.string().trim().max(120).default(''),
  })
  .refine((b) => b.allDay || (b.start && b.end && b.end > b.start), {
    message: 'Informe início e fim, com o fim depois do início.',
  })
export type BlockInput = z.input<typeof blockSchema>

export type BlockConflict = { code: string; startsAt: Date }

/** Creates a block unless an active appointment overlaps it (then returns the conflicts). */
export async function createBlock(
  db: Db,
  raw: BlockInput,
  deps: ActorDeps,
): Promise<{ ok: true; id: string } | { ok: false; conflicts: BlockConflict[] }> {
  const b = blockSchema.parse(raw)
  const startsAt = localToInstant(b.date, b.allDay ? 0 : timeToMinutes(b.start!))
  const endsAt = b.allDay
    ? localToInstant(b.endDate && b.endDate >= b.date ? b.endDate : b.date, 24 * 60)
    : localToInstant(b.date, timeToMinutes(b.end!))
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${AGENDA_LOCK_KEY})`)
    const conflicts = await tx
      .select({ codeSeq: schema.bookings.codeSeq, startsAt: schema.bookings.startsAt })
      .from(schema.bookings)
      .where(
        and(
          sql`${schema.bookings.status} in ('pendente', 'confirmado')`,
          sql`${schema.bookings.occupied} && tstzrange(${startsAt.toISOString()}::timestamptz, ${endsAt.toISOString()}::timestamptz, '[)')`,
        ),
      )
    if (conflicts.length) {
      return {
        ok: false as const,
        conflicts: conflicts.map((c) => ({
          code: formatBookingCode(c.codeSeq),
          startsAt: c.startsAt,
        })),
      }
    }
    const [row] = await tx
      .insert(schema.blocks)
      .values({
        startsAt,
        endsAt,
        allDay: b.allDay,
        reason: b.reason,
        createdAt: deps.now,
        updatedAt: deps.now,
      })
      .returning({ id: schema.blocks.id })
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'block.created',
      targetType: 'block',
      targetId: row!.id,
      ip: deps.ip,
      now: deps.now,
    })
    return { ok: true as const, id: row!.id }
  })
}

export async function deleteBlock(db: Db, id: string, deps: ActorDeps): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.blocks).where(eq(schema.blocks.id, id))
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'block.deleted',
      targetType: 'block',
      targetId: id,
      ip: deps.ip,
      now: deps.now,
    })
  })
}
