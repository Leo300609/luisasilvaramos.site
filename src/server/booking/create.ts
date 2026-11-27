/**
 * Creating a booking: the only path that writes a new appointment.
 *
 * Guarantees (docs/adr/0004-concorrencia.md):
 *  1. Idempotent: the same idempotency key returns the same booking.
 *  2. Serialized: a transaction-level advisory lock orders concurrent writers.
 *  3. Revalidated: availability is recomputed on the server inside the lock;
 *     nothing the browser sends (price, duration, end time) is trusted.
 *  4. Enforced by the database: the EXCLUDE constraint rejects any overlap
 *     that slipped through (SQLSTATE 23P01).
 */
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { encryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { enqueueEmail } from '../email/enqueue'
import { checkEventFit } from '../scheduling/availability'
import { getDaySlots, loadConfig, type Db } from '../scheduling/context'
import { addMinutes, localToInstant, timeToMinutes } from '../scheduling/time'
import { BookingError } from './errors'
import { normalizeBrazilianPhone } from './phone'

/** Arbitrary constant: every agenda write takes this lock (single-artist agenda). */
const AGENDA_LOCK_KEY = 4_157_002

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const createBookingSchema = z.object({
  idempotencyKey: z.string().min(16).max(100),
  serviceId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: timeString,
  eventStart: timeString,
  eventDuration: z.enum(schema.eventDuration.enumValues),
  customer: z.object({
    name: z.string().trim().min(5).max(120),
    phone: z.string().trim().min(10).max(20),
    email: z.email().max(200),
  }),
  address: z.object({
    line: z.string().trim().min(8).max(300),
    complement: z.string().trim().max(200).optional(),
  }),
  /** Server-computed travel quote for this address (never accepted from the browser). */
  travel: z.object({
    feeCents: z.number().int().min(0),
    toMin: z.number().int().min(0).max(240),
    backMin: z.number().int().min(0).max(240),
    distanceKm: z.number().min(0).max(500),
  }),
  lookNotes: z.string().trim().max(1000).optional(),
  allergyNotes: z.string().trim().max(1000).optional(),
  /** Explicit consent for health data (LGPD art. 11) is required to store allergies. */
  allergyConsent: z.boolean().default(false),
  source: z.enum(['site', 'admin']).default('site'),
})

export type CreateBookingInput = z.input<typeof createBookingSchema>

export type CreateBookingResult = {
  id: string
  code: string
  status: 'pendente' | 'confirmado'
  replayed: boolean
}

export const formatBookingCode = (seq: number) => `LSR-${String(seq).padStart(4, '0')}`

type PgError = { code?: string; constraint?: string; cause?: unknown }
function pgCode(error: unknown): PgError {
  const e = error as PgError
  return e?.code ? e : ((e?.cause as PgError | undefined) ?? {})
}

async function findByIdempotencyKey(db: Db, key: string): Promise<CreateBookingResult | null> {
  const [row] = await db
    .select({
      id: schema.bookings.id,
      codeSeq: schema.bookings.codeSeq,
      status: schema.bookings.status,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.idempotencyKey, key))
  if (!row) return null
  return {
    id: row.id,
    code: formatBookingCode(row.codeSeq),
    status: row.status === 'confirmado' ? 'confirmado' : 'pendente',
    replayed: true,
  }
}

export async function createBooking(
  db: Db,
  rawInput: CreateBookingInput,
  deps: { now: Date; keyRing: KeyRing },
): Promise<CreateBookingResult> {
  const input = createBookingSchema.parse(rawInput)
  const phone = normalizeBrazilianPhone(input.customer.phone)
  if (!phone) throw new BookingError('invalid-input', 'Telefone inválido.')
  if (input.allergyNotes && !input.allergyConsent) {
    throw new BookingError('consent-required', 'Consentimento necessário para dados de saúde.')
  }

  const existing = await findByIdempotencyKey(db, input.idempotencyKey)
  if (existing) return existing

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${AGENDA_LOCK_KEY})`)

      const replay = await findByIdempotencyKey(tx, input.idempotencyKey)
      if (replay) return replay

      const [service] = await tx
        .select()
        .from(schema.services)
        .where(and(eq(schema.services.id, input.serviceId), eq(schema.services.active, true)))
      if (!service) throw new BookingError('service-unavailable', 'Serviço indisponível.')

      const config = await loadConfig(tx)
      const travel = { toMin: input.travel.toMin, backMin: input.travel.backMin }
      const slots = await getDaySlots(
        tx,
        {
          date: input.date,
          now: deps.now,
          durationMin: service.durationMin,
          travel,
          eventStart: input.eventStart,
        },
        config,
      )
      const slot = slots.find((s) => s.time === input.time)
      if (!slot) throw new BookingError('slot-taken', 'Esse horário acabou de ser reservado.')

      // Defence in depth: the event rule must hold for the chosen slot.
      const fit = checkEventFit(
        timeToMinutes(input.time) + service.durationMin,
        timeToMinutes(input.eventStart),
        config.rules,
      )
      if (!fit.ok)
        throw new BookingError('event-too-early', 'A maquiagem terminaria depois do horário.')

      // Anti-abuse: limit pending bookings per contact (no mass reservations).
      const [{ pending } = { pending: 0 }] = await tx
        .select({ pending: sql<number>`count(*)::int` })
        .from(schema.bookings)
        .innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
        .where(
          and(
            eq(schema.bookings.status, 'pendente'),
            sql`(${schema.customers.phoneE164} = ${phone} or ${schema.customers.email} = ${input.customer.email.toLowerCase()})`,
          ),
        )
      if (pending >= config.maxPendingPerContact) {
        throw new BookingError('too-many-pending', 'Você já tem pedidos aguardando confirmação.')
      }

      const email = input.customer.email.toLowerCase()
      const [customer] = await tx
        .insert(schema.customers)
        .values({ name: input.customer.name, phoneE164: phone, email })
        .onConflictDoUpdate({
          target: schema.customers.phoneE164,
          targetWhere: sql`${schema.customers.anonymizedAt} is null`,
          set: { name: input.customer.name, email, updatedAt: deps.now },
        })
        .returning({ id: schema.customers.id })
      if (!customer) throw new Error('customer upsert failed')

      const enc = (value: string | undefined, field: string) =>
        value ? encryptField(value, deps.keyRing, `bookings.${field}`) : null

      const autoConfirm = !config.manualConfirmation || input.source === 'admin'
      const status = autoConfirm ? 'confirmado' : 'pendente'
      const startsAt = slot.start
      const [row] = await tx
        .insert(schema.bookings)
        .values({
          customerId: customer.id,
          serviceId: service.id,
          serviceName: service.name,
          durationMin: service.durationMin,
          priceCents: service.priceCents,
          travelFeeCents: input.travel.feeCents,
          travelToMin: input.travel.toMin,
          travelBackMin: input.travel.backMin,
          travelDistanceKm: input.travel.distanceKm.toFixed(1),
          bufferMin: config.rules.bufferMin,
          startsAt,
          endsAt: addMinutes(startsAt, service.durationMin),
          eventStartsAt: localToInstant(input.date, timeToMinutes(input.eventStart)),
          eventDuration: input.eventDuration,
          addressEnc: enc(input.address.line, 'address') ?? '',
          complementEnc: enc(input.address.complement, 'complement'),
          lookNotesEnc: enc(input.lookNotes, 'look_notes'),
          allergyNotesEnc: enc(input.allergyNotes, 'allergy_notes'),
          status,
          source: input.source,
          idempotencyKey: input.idempotencyKey,
          expiresAt: autoConfirm ? null : addMinutes(deps.now, config.pendingExpiryHours * 60),
          confirmedAt: autoConfirm ? deps.now : null,
        })
        .returning({ id: schema.bookings.id, codeSeq: schema.bookings.codeSeq })
      if (!row) throw new Error('booking insert failed')

      await tx.insert(schema.bookingEvents).values({
        bookingId: row.id,
        type: 'created',
        actor: input.source === 'admin' ? 'admin' : 'cliente',
        data: { status, fit: slot.fit },
      })

      // Same transaction: the e-mails exist if and only if the booking does.
      for (const recipient of ['cliente', 'luisa'] as const) {
        await enqueueEmail(tx, {
          kind: 'booking_created',
          recipient,
          bookingId: row.id,
          dedupeKey: `booking_created:${recipient}:${row.id}`,
          data: { expiryHours: config.pendingExpiryHours },
          createdAt: deps.now,
        })
      }

      return { id: row.id, code: formatBookingCode(row.codeSeq), status, replayed: false }
    })
  } catch (error) {
    const pg = pgCode(error)
    if (pg.code === '23P01') {
      throw new BookingError('slot-taken', 'Esse horário acabou de ser reservado.')
    }
    if (pg.code === '23505' && pg.constraint?.includes('idempotency')) {
      const replay = await findByIdempotencyKey(db, input.idempotencyKey)
      if (replay) return replay
    }
    throw error
  }
}
