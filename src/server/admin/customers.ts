/**
 * Clients in the panel, including the data-subject rights of the LGPD
 * (art. 18): access/portability (export) and deletion (anonymisation).
 */
import { and, count, desc, eq, ilike, isNull, max, or, sql } from 'drizzle-orm'

import { decryptField, encryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { audit } from '../auth/audit'
import { formatBookingCode } from '../booking/create'
import { BookingError } from '../booking/errors'
import { revokeTokens } from '../booking/tokens'
import type { Db } from '../scheduling/context'
import { instantToLocal, minutesToTime } from '../scheduling/time'
import type { ActorDeps } from './manage'

export const CUSTOMERS_PAGE = 30

export type CustomerRow = {
  id: string
  name: string
  phone: string
  email: string
  bookings: number
  lastAt: string | null
}

export async function listCustomers(
  db: Db,
  opts: { q?: string; page: number },
): Promise<{ rows: CustomerRow[]; total: number }> {
  const q = opts.q?.trim()
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null
  const digits = q?.replace(/\D/g, '') ?? ''
  const filter = and(
    isNull(schema.customers.anonymizedAt),
    like
      ? or(
          ilike(schema.customers.name, like),
          ilike(schema.customers.email, like),
          ...(digits.length >= 4 ? [ilike(schema.customers.phoneE164, `%${digits}%`)] : []),
        )
      : undefined,
  )
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: schema.customers.id,
        name: schema.customers.name,
        phone: schema.customers.phoneE164,
        email: schema.customers.email,
        bookings: count(schema.bookings.id),
        lastAt: max(schema.bookings.startsAt),
      })
      .from(schema.customers)
      .leftJoin(schema.bookings, eq(schema.bookings.customerId, schema.customers.id))
      .where(filter)
      .groupBy(schema.customers.id)
      .orderBy(desc(sql`max(${schema.bookings.startsAt})`), schema.customers.name)
      .limit(CUSTOMERS_PAGE)
      .offset((Math.max(1, opts.page) - 1) * CUSTOMERS_PAGE),
    db.select({ n: count() }).from(schema.customers).where(filter),
  ])
  return {
    total: total?.n ?? 0,
    rows: rows.map((r) => ({ ...r, lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null })),
  }
}

export type CustomerProfile = {
  id: string
  name: string
  phone: string
  email: string
  createdAt: string
  notes: string
  anonymized: boolean
  stats: { total: number; done: number; cancelled: number; noShow: number; spentCents: number }
  bookings: Array<{
    id: string
    code: string
    status: (typeof schema.bookingStatus.enumValues)[number]
    date: string
    time: string
    serviceName: string
    totalCents: number
  }>
}

export async function getCustomer(
  db: Db,
  id: string,
  keyRing: KeyRing,
): Promise<CustomerProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, id))
  if (!c) return null
  const rows = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.customerId, id))
    .orderBy(desc(schema.bookings.startsAt))
  const bookings = rows.map((b) => {
    const start = instantToLocal(b.startsAt)
    return {
      id: b.id,
      code: formatBookingCode(b.codeSeq),
      status: b.status,
      date: start.date,
      time: minutesToTime(start.minutes),
      serviceName: b.serviceName,
      totalCents: b.priceCents + b.travelFeeCents,
    }
  })
  return {
    id: c.id,
    name: c.name,
    phone: c.phoneE164,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    notes: c.internalNotesEnc
      ? decryptField(c.internalNotesEnc, keyRing, 'customers.internal_notes')
      : '',
    anonymized: Boolean(c.anonymizedAt),
    stats: {
      total: rows.length,
      done: rows.filter((b) => b.status === 'concluido').length,
      cancelled: rows.filter((b) => b.status === 'cancelado' && b.cancelReason !== 'nao_compareceu')
        .length,
      noShow: rows.filter((b) => b.cancelReason === 'nao_compareceu').length,
      spentCents: rows
        .filter((b) => b.status === 'concluido')
        .reduce((sum, b) => sum + b.priceCents + b.travelFeeCents, 0),
    },
    bookings,
  }
}

export async function saveCustomerNotes(
  db: Db,
  id: string,
  notes: string,
  deps: ActorDeps & { keyRing: KeyRing },
): Promise<void> {
  const text = notes.trim().slice(0, 2000)
  await db.transaction(async (tx) => {
    await tx
      .update(schema.customers)
      .set({
        internalNotesEnc: text
          ? encryptField(text, deps.keyRing, 'customers.internal_notes')
          : null,
        updatedAt: deps.now,
      })
      .where(eq(schema.customers.id, id))
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'customer.notes_saved',
      targetType: 'customer',
      targetId: id,
      ip: deps.ip,
      now: deps.now,
    })
  })
}

/** Everything stored about a client, decrypted, for an LGPD access/portability request. */
export async function exportCustomer(db: Db, id: string, deps: ActorDeps & { keyRing: KeyRing }) {
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, id))
  if (!c) return null
  const dec = (v: string | null, aad: string) => (v ? decryptField(v, deps.keyRing, aad) : null)
  const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.customerId, id))
  await audit(db, deps.secret, {
    actorId: deps.actorId,
    action: 'customer.exported',
    targetType: 'customer',
    targetId: id,
    ip: deps.ip,
    now: deps.now,
  })
  return {
    geradoEm: deps.now.toISOString(),
    controladora: 'Luísa Silva Ramos',
    titular: {
      nome: c.name,
      whatsapp: c.phoneE164,
      email: c.email,
      cadastradaEm: c.createdAt.toISOString(),
    },
    agendamentos: rows.map((b) => ({
      codigo: formatBookingCode(b.codeSeq),
      servico: b.serviceName,
      inicio: b.startsAt.toISOString(),
      fim: b.endsAt.toISOString(),
      status: b.status,
      valorServicoCentavos: b.priceCents,
      taxaDeslocamentoCentavos: b.travelFeeCents,
      endereco: dec(b.addressEnc || null, 'bookings.address'),
      complemento: dec(b.complementEnc, 'bookings.complement'),
      observacoesLook: dec(b.lookNotesEnc, 'bookings.look_notes'),
      alergias: dec(b.allergyNotesEnc, 'bookings.allergy_notes'),
      criadoEm: b.createdAt.toISOString(),
    })),
  }
}

/**
 * Deletion request (LGPD art. 18, VI): removes identifying and sensitive data
 * and keeps only what accounting needs (dates, services, amounts). Refused
 * while the client has an upcoming active appointment.
 */
export async function anonymizeCustomer(db: Db, id: string, deps: ActorDeps): Promise<void> {
  await db.transaction(async (tx) => {
    const [active] = await tx
      .select({ n: count() })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.customerId, id),
          sql`${schema.bookings.status} in ('pendente', 'confirmado')`,
          sql`${schema.bookings.endsAt} > ${deps.now}`,
        ),
      )
    if (active?.n) {
      throw new BookingError(
        'invalid-input',
        'A cliente tem atendimento futuro. Cancele ou conclua antes de apagar os dados.',
      )
    }
    const [c] = await tx
      .update(schema.customers)
      .set({
        name: 'Cliente removida',
        email: '',
        phoneE164: `anon:${id}`,
        cpfEnc: null,
        internalNotesEnc: null,
        anonymizedAt: deps.now,
        updatedAt: deps.now,
      })
      .where(and(eq(schema.customers.id, id), isNull(schema.customers.anonymizedAt)))
      .returning({ id: schema.customers.id })
    if (!c) throw new BookingError('invalid-input', 'Cliente não encontrada ou já removida.')
    const bookings = await tx
      .update(schema.bookings)
      .set({
        addressEnc: '',
        complementEnc: null,
        lookNotesEnc: null,
        allergyNotesEnc: null,
        internalNotesEnc: null,
        updatedAt: deps.now,
      })
      .where(eq(schema.bookings.customerId, id))
      .returning({ id: schema.bookings.id })
    for (const b of bookings) await revokeTokens(tx, b.id, deps.now)
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'customer.anonymized',
      targetType: 'customer',
      targetId: id,
      ip: deps.ip,
      now: deps.now,
    })
  })
}
