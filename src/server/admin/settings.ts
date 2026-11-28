/** Everything the Luísa adjusts herself (Phase 0: P3, P6, P7). Audited, validated server-side. */
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { decryptField, encryptField, type KeyRing } from '../crypto/fields'
import * as schema from '../db/schema'
import { audit } from '../auth/audit'
import type { CepLookup } from '../booking/quote'
import type { Db } from '../scheduling/context'
import type { ActorDeps } from './manage'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.')

// ── Services ────────────────────────────────────────────────────────────────

export const serviceSchema = z.object({
  name: z.string().trim().min(3, 'Nome muito curto.').max(80),
  category: z.string().trim().min(2).max(40),
  durationMin: z.coerce.number().int().min(15, 'Duração mínima: 15 min.').max(600),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  description: z.string().trim().max(300).default(''),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})
export type ServiceInput = z.input<typeof serviceSchema>

export const listServices = (db: Db) =>
  db
    .select()
    .from(schema.services)
    .orderBy(asc(schema.services.sortOrder), asc(schema.services.name))

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

/** Price and duration changes apply to new bookings only (bookings keep a snapshot). */
export async function saveService(
  db: Db,
  id: number | null,
  raw: ServiceInput,
  deps: ActorDeps,
): Promise<number> {
  const s = serviceSchema.parse(raw)
  return db.transaction(async (tx) => {
    let serviceId: number
    if (id) {
      const [row] = await tx
        .update(schema.services)
        .set({ ...s, updatedAt: deps.now })
        .where(eq(schema.services.id, id))
        .returning({ id: schema.services.id })
      if (!row) throw new Error('Serviço não encontrado.')
      serviceId = row.id
    } else {
      const base = slugify(s.name) || 'servico'
      let slug = base
      for (let n = 2; ; n++) {
        const [taken] = await tx
          .select({ id: schema.services.id })
          .from(schema.services)
          .where(eq(schema.services.slug, slug))
        if (!taken) break
        slug = `${base}-${n}`
      }
      const [row] = await tx
        .insert(schema.services)
        .values({ ...s, slug, createdAt: deps.now, updatedAt: deps.now })
        .returning({ id: schema.services.id })
      serviceId = row!.id
    }
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: id ? 'service.updated' : 'service.created',
      targetType: 'service',
      targetId: String(serviceId),
      ip: deps.ip,
      data: { priceCents: s.priceCents, durationMin: s.durationMin, active: s.active },
      now: deps.now,
    })
    return serviceId
  })
}

// ── Weekly hours ────────────────────────────────────────────────────────────

export const hoursSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      isOpen: z.boolean(),
      opensAt: time,
      closesAt: time,
    }),
  )
  .length(7)
  .refine(
    (days) => days.every((d) => d.closesAt > d.opensAt),
    'O fim do expediente precisa ser depois do início.',
  )

export async function saveHours(db: Db, raw: z.input<typeof hoursSchema>, deps: ActorDeps) {
  const days = hoursSchema.parse(raw)
  await db.transaction(async (tx) => {
    for (const d of days) {
      await tx
        .insert(schema.businessHours)
        .values(d)
        .onConflictDoUpdate({
          target: schema.businessHours.weekday,
          set: { isOpen: d.isOpen, opensAt: d.opensAt, closesAt: d.closesAt },
        })
    }
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'hours.updated',
      ip: deps.ip,
      now: deps.now,
    })
  })
}

// ── Rules and travel ────────────────────────────────────────────────────────

export const rulesSchema = z
  .object({
    manualConfirmation: z.boolean(),
    bookingsPaused: z.boolean(),
    pendingExpiryHours: z.coerce.number().int().min(1).max(168),
    minNoticeHours: z.coerce.number().int().min(0).max(720),
    horizonDays: z.coerce.number().int().min(7).max(730),
    cancelWindowHours: z.coerce.number().int().min(0).max(720),
    bufferMin: z.coerce.number().int().min(0).max(120),
    slotStepMin: z.coerce.number().int().min(5).max(240),
    lunchEnabled: z.boolean(),
    lunchStart: time,
    lunchEnd: time,
    readyBeforeEventMin: z.coerce.number().int().min(0).max(240),
    recommendedMarginMin: z.coerce.number().int().min(0).max(480),
    maxPendingPerContact: z.coerce.number().int().min(1).max(10),
    travelMinFeeCents: z.coerce.number().int().min(0).max(1_000_000),
    travelPerKmCents: z.coerce.number().int().min(0).max(100_000),
    travelMaxRadiusKm: z.coerce.number().int().min(1).max(500),
    travelSafetyFactor: z.coerce.number().min(1).max(3),
  })
  .refine(
    (r) => !r.lunchEnabled || r.lunchEnd > r.lunchStart,
    'O fim do almoço precisa ser depois do início.',
  )
export type RulesInput = z.input<typeof rulesSchema>

export async function loadSettings(db: Db, keyRing: KeyRing) {
  const [row] = await db
    .select()
    .from(schema.scheduleSettings)
    .where(eq(schema.scheduleSettings.id, 1))
  if (!row) throw new Error('schedule_settings row missing')
  const hours = await db
    .select()
    .from(schema.businessHours)
    .orderBy(asc(schema.businessHours.weekday))
  return {
    rules: {
      manualConfirmation: row.manualConfirmation,
      bookingsPaused: row.bookingsPaused,
      pendingExpiryHours: row.pendingExpiryHours,
      minNoticeHours: row.minNoticeHours,
      horizonDays: row.horizonDays,
      cancelWindowHours: row.cancelWindowHours,
      bufferMin: row.bufferMin,
      slotStepMin: row.slotStepMin,
      lunchEnabled: row.lunchEnabled,
      lunchStart: row.lunchStart.slice(0, 5),
      lunchEnd: row.lunchEnd.slice(0, 5),
      readyBeforeEventMin: row.readyBeforeEventMin,
      recommendedMarginMin: row.recommendedMarginMin,
      maxPendingPerContact: row.maxPendingPerContact,
      travelMinFeeCents: row.travelMinFeeCents,
      travelPerKmCents: row.travelPerKmCents,
      travelMaxRadiusKm: row.travelMaxRadiusKm,
      travelSafetyFactor: Number(row.travelSafetyFactor),
    },
    baseAddress: row.baseAddressEnc
      ? decryptField(row.baseAddressEnc, keyRing, 'schedule_settings.base_address')
      : null,
    hours: Array.from({ length: 7 }, (_, weekday) => {
      const h = hours.find((x) => x.weekday === weekday)
      return {
        weekday,
        isOpen: h?.isOpen ?? false,
        opensAt: (h?.opensAt ?? '08:00').slice(0, 5),
        closesAt: (h?.closesAt ?? '19:00').slice(0, 5),
      }
    }),
  }
}

export async function saveRules(db: Db, raw: RulesInput, deps: ActorDeps) {
  const r = rulesSchema.parse(raw)
  await db.transaction(async (tx) => {
    await tx
      .update(schema.scheduleSettings)
      .set({ ...r, travelSafetyFactor: r.travelSafetyFactor.toFixed(2), updatedAt: deps.now })
      .where(eq(schema.scheduleSettings.id, 1))
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'rules.updated',
      ip: deps.ip,
      data: { manualConfirmation: r.manualConfirmation, bookingsPaused: r.bookingsPaused },
      now: deps.now,
    })
  })
}

/** Luísa's departure point: looked up by CEP, stored encrypted (it is her home). */
export async function saveBaseAddress(
  db: Db,
  input: { cep: string; number: string },
  deps: ActorDeps & { keyRing: KeyRing; lookup: CepLookup },
): Promise<
  { ok: true; address: string } | { ok: false; reason: 'cep-not-found' | 'no-coordinates' }
> {
  const found = await deps.lookup(input.cep)
  if (!found) return { ok: false, reason: 'cep-not-found' }
  if (!found.location) return { ok: false, reason: 'no-coordinates' }
  const address = `${found.street}, ${input.number.trim() || 's/n'} · ${found.neighborhood} · ${found.city}/${found.state}`
  await db.transaction(async (tx) => {
    await tx
      .update(schema.scheduleSettings)
      .set({
        baseAddressEnc: encryptField(address, deps.keyRing, 'schedule_settings.base_address'),
        baseLocationEnc: encryptField(
          JSON.stringify(found.location),
          deps.keyRing,
          'schedule_settings.base_location',
        ),
        updatedAt: deps.now,
      })
      .where(eq(schema.scheduleSettings.id, 1))
    await audit(tx, deps.secret, {
      actorId: deps.actorId,
      action: 'base_address.updated',
      ip: deps.ip,
      now: deps.now,
    })
  })
  return { ok: true, address }
}
