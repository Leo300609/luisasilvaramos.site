'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { confirmBooking, declineBooking } from '@/server/admin/bookings'
import {
  ADMIN_CANCEL_REASONS,
  blockSchema,
  cancelFromPanel,
  closeFromPanel,
  createBlock,
  createBookingFromPanel,
  deleteBlock,
  rescheduleFromPanel,
  saveInternalNotes,
  type AdminBookingInput,
} from '@/server/admin/manage'
import { anonymizeCustomer, saveCustomerNotes } from '@/server/admin/customers'
import { saveBaseAddress, saveHours, saveRules, saveService } from '@/server/admin/settings'
import { quoteForAddress } from '@/server/booking/quote'
import { getCepLookup, getKeyRing, getRouteProvider, getSigningSecret } from '@/server/runtime'
import {
  adminToken,
  authDeps,
  clearAdminCookie,
  clientInfo,
  requireAdmin,
} from '@/server/admin/session'
import { audit } from '@/server/auth/audit'
import { revokeAllSessions, revokeSession } from '@/server/auth/service'
import { BookingError } from '@/server/booking/errors'
import { getDb } from '@/server/db/client'
import { deliverEmailsAfterResponse } from '@/server/email/dispatch'

const id = z.uuid()

export async function logoutAction(): Promise<void> {
  const token = await adminToken()
  const db = getDb()
  if (token) {
    const { user } = await requireAdmin()
    await revokeSession(db, token, new Date())
    await audit(db, authDeps().secret, {
      actorId: user.id,
      action: 'logout',
      ip: (await clientInfo()).ip,
      now: new Date(),
    })
  }
  await clearAdminCookie()
  redirect('/admin/entrar')
}

/** "Sair de todos os dispositivos" (e.g. after losing a phone). */
export async function logoutEverywhereAction(): Promise<void> {
  const { user } = await requireAdmin()
  const db = getDb()
  const now = new Date()
  await revokeAllSessions(db, user.id, now)
  await audit(db, authDeps().secret, {
    actorId: user.id,
    action: 'logout.all',
    ip: (await clientInfo()).ip,
    now,
  })
  await clearAdminCookie()
  redirect('/admin/entrar')
}

export type BookingActionState = { error?: string }

export async function confirmBookingAction(
  bookingId: string,
  _prev: BookingActionState,
): Promise<BookingActionState> {
  const { user } = await requireAdmin()
  if (!id.safeParse(bookingId).success) return { error: 'Agendamento inválido.' }
  try {
    await confirmBooking(getDb(), bookingId, {
      now: new Date(),
      actorId: user.id,
      secret: authDeps().secret,
      ip: (await clientInfo()).ip,
    })
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    throw error
  }
  deliverEmailsAfterResponse()
  redirect(`/admin/agendamentos/${bookingId}?feito=confirmado`)
}

export async function declineBookingAction(
  bookingId: string,
  _prev: BookingActionState,
  form: FormData,
): Promise<BookingActionState> {
  const { user } = await requireAdmin()
  if (!id.safeParse(bookingId).success) return { error: 'Agendamento inválido.' }
  const note = String(form.get('note') ?? '').slice(0, 500)
  try {
    await declineBooking(getDb(), bookingId, {
      now: new Date(),
      actorId: user.id,
      secret: authDeps().secret,
      ip: (await clientInfo()).ip,
      note,
    })
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    throw error
  }
  deliverEmailsAfterResponse()
  redirect(`/admin/agendamentos/${bookingId}?feito=recusado`)
}

// ── 5b: agenda management ───────────────────────────────────────────────────

async function actorDeps() {
  const { user } = await requireAdmin()
  return {
    now: new Date(),
    actorId: user.id,
    secret: authDeps().secret,
    ip: (await clientInfo()).ip,
  }
}

export type FormState = { error?: string; ok?: string }

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
const dateRe = /^\d{4}-\d{2}-\d{2}$/

export async function rescheduleAction(
  bookingId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const deps = await actorDeps()
  const date = String(form.get('date') ?? '')
  const time = String(form.get('time') ?? '')
  if (!id.safeParse(bookingId).success || !dateRe.test(date) || !timeRe.test(time)) {
    return { error: 'Informe data e horário válidos.' }
  }
  try {
    await rescheduleFromPanel(
      getDb(),
      bookingId,
      { date, time, notify: form.get('notify') === 'on' },
      deps,
    )
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    throw error
  }
  deliverEmailsAfterResponse()
  redirect(`/admin/agendamentos/${bookingId}?feito=remarcado`)
}

export async function cancelAction(
  bookingId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const deps = await actorDeps()
  const reason = z.enum(ADMIN_CANCEL_REASONS).safeParse(form.get('reason'))
  if (!id.safeParse(bookingId).success || !reason.success) return { error: 'Escolha o motivo.' }
  try {
    await cancelFromPanel(
      getDb(),
      bookingId,
      {
        reason: reason.data,
        note: String(form.get('note') ?? ''),
        notify: form.get('notify') === 'on',
      },
      deps,
    )
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    throw error
  }
  deliverEmailsAfterResponse()
  redirect(`/admin/agendamentos/${bookingId}?feito=cancelado`)
}

export async function closeAction(
  bookingId: string,
  outcome: 'concluido' | 'nao_compareceu',
  _prev: FormState,
): Promise<FormState> {
  const deps = await actorDeps()
  if (!id.safeParse(bookingId).success) return { error: 'Agendamento inválido.' }
  try {
    await closeFromPanel(getDb(), bookingId, outcome, deps)
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    throw error
  }
  redirect(
    `/admin/agendamentos/${bookingId}?feito=${outcome === 'concluido' ? 'concluido' : 'falta'}`,
  )
}

export async function notesAction(
  bookingId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const deps = await actorDeps()
  if (!id.safeParse(bookingId).success) return { error: 'Agendamento inválido.' }
  await saveInternalNotes(getDb(), bookingId, String(form.get('notes') ?? ''), {
    ...deps,
    keyRing: getKeyRing(),
  })
  return { ok: 'Anotação salva.' }
}

export async function createBlockAction(_prev: FormState, form: FormData): Promise<FormState> {
  const deps = await actorDeps()
  const allDay = form.get('allDay') === 'on'
  const parsed = blockSchema.safeParse({
    date: form.get('date'),
    endDate: allDay && form.get('endDate') ? form.get('endDate') : undefined,
    allDay,
    start: allDay ? undefined : form.get('start'),
    end: allDay ? undefined : form.get('end'),
    reason: form.get('reason') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }
  const result = await createBlock(getDb(), parsed.data, deps)
  if (!result.ok) {
    const list = result.conflicts.map((c) => c.code).join(', ')
    return {
      error: `Há atendimento nesse período (${list}). Remarque ou cancele antes de bloquear.`,
    }
  }
  revalidatePath('/admin/agenda/bloqueios')
  return { ok: 'Bloqueio criado.' }
}

export async function deleteBlockAction(blockId: string): Promise<void> {
  const deps = await actorDeps()
  if (id.safeParse(blockId).success) await deleteBlock(getDb(), blockId, deps)
  redirect('/admin/agenda/bloqueios')
}

export type NewBookingState = {
  error?: string
  quote?: { feeCents: number; toMin: number; backMin: number; distanceKm: number; address: string }
}

export async function newBookingAction(
  _prev: NewBookingState,
  form: FormData,
): Promise<NewBookingState> {
  const deps = await actorDeps()
  const db = getDb()
  const get = (k: string) => String(form.get(k) ?? '').trim()
  const cep = get('cep')
  const number = get('number')
  let travel = { feeCents: 0, toMin: 0, backMin: 0, distanceKm: null as number | null }
  let address = get('address')
  if (cep) {
    const q = await quoteForAddress(
      db,
      { cep, number: number || 's/n' },
      {
        keyRing: getKeyRing(),
        routes: getRouteProvider(),
        secret: getSigningSecret(),
        now: deps.now,
        lookup: getCepLookup(),
      },
    )
    if (!q.ok) {
      const msg: Record<string, string> = {
        'cep-not-found': 'CEP não encontrado.',
        'no-coordinates':
          'Não foi possível localizar esse CEP. Preencha o endereço e a taxa à mão.',
        'out-of-radius': 'Fora do raio de atendimento. Preencha o endereço e a taxa à mão.',
        'base-not-configured':
          'Cadastre o endereço de saída em Ajustes para calcular o deslocamento.',
      }
      return { error: msg[q.reason] ?? 'Não foi possível calcular o deslocamento.' }
    }
    travel = {
      feeCents: q.quote.feeCents,
      toMin: q.quote.toMin,
      backMin: q.quote.backMin,
      distanceKm: q.quote.distanceKm,
    }
    address = q.quote.addressLine
  } else {
    const fee = Math.round(Number((get('fee') || '0').replace(',', '.')) * 100)
    const minutes = Number(get('travelMin') || '0')
    travel = {
      feeCents: Number.isFinite(fee) ? fee : 0,
      toMin: Number.isFinite(minutes) ? minutes : 0,
      backMin: Number.isFinite(minutes) ? minutes : 0,
      distanceKm: null,
    }
  }
  try {
    const result = await createBookingFromPanel(
      db,
      {
        serviceId: Number(get('serviceId')),
        date: get('date'),
        time: get('time'),
        ...(get('eventStart') ? { eventStart: get('eventStart') } : {}),
        ...(get('eventDuration')
          ? { eventDuration: get('eventDuration') as AdminBookingInput['eventDuration'] }
          : {}),
        customer: { name: get('name'), phone: get('phone'), email: get('email') },
        address: address || 'Endereço a confirmar',
        ...(get('complement') ? { complement: get('complement') } : {}),
        travel,
        ...(get('notes') ? { notes: get('notes') } : {}),
      },
      { ...deps, keyRing: getKeyRing() },
    )
    deliverEmailsAfterResponse()
    redirect(`/admin/agendamentos/${result.id}?feito=criado`)
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    if (error instanceof z.ZodError) {
      const field = error.issues[0]?.path.join('.') ?? ''
      const names: Record<string, string> = {
        serviceId: 'serviço',
        date: 'data',
        time: 'horário',
        'customer.name': 'nome',
        'customer.phone': 'WhatsApp',
        'customer.email': 'e-mail',
      }
      return { error: `Confira o campo ${names[field] ?? field}.` }
    }
    throw error
  }
}

// ── 5b: clients ─────────────────────────────────────────────────────────────

export async function customerNotesAction(
  customerId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const deps = await actorDeps()
  if (!id.safeParse(customerId).success) return { error: 'Cliente inválida.' }
  await saveCustomerNotes(getDb(), customerId, String(form.get('notes') ?? ''), {
    ...deps,
    keyRing: getKeyRing(),
  })
  return { ok: 'Anotação salva.' }
}

export async function forgetCustomerAction(
  customerId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const deps = await actorDeps()
  if (!id.safeParse(customerId).success) return { error: 'Cliente inválida.' }
  if (form.get('confirm') !== 'APAGAR') return { error: 'Digite APAGAR para confirmar.' }
  try {
    await anonymizeCustomer(getDb(), customerId, deps)
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message }
    throw error
  }
  redirect(`/admin/clientes/${customerId}?feito=removida`)
}

// ── 5c: settings ────────────────────────────────────────────────────────────

/** "1.234,56" / "200" / "R$ 30,00" → cents. */
function parseMoney(value: FormDataEntryValue | null): number {
  const clean = String(value ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const n = Math.round(Number(clean) * 100)
  return Number.isFinite(n) ? n : -1
}

const zodMessage = (error: z.ZodError) => error.issues[0]?.message ?? 'Confira os campos.'

export async function serviceAction(
  serviceId: number | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const deps = await actorDeps()
  try {
    await saveService(
      getDb(),
      serviceId,
      {
        name: String(form.get('name') ?? ''),
        category: String(form.get('category') ?? ''),
        durationMin: Number(form.get('durationMin')),
        priceCents: parseMoney(form.get('price')),
        description: String(form.get('description') ?? ''),
        active: form.get('active') === 'on',
        sortOrder: Number(form.get('sortOrder') ?? 0),
      },
      deps,
    )
  } catch (error) {
    if (error instanceof z.ZodError) return { error: zodMessage(error) }
    throw error
  }
  revalidatePath('/admin/ajustes')
  return { ok: serviceId ? 'Serviço salvo.' : 'Serviço criado.' }
}

export async function hoursAction(_prev: FormState, form: FormData): Promise<FormState> {
  const deps = await actorDeps()
  try {
    await saveHours(
      getDb(),
      Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        isOpen: form.get(`open-${weekday}`) === 'on',
        opensAt: String(form.get(`from-${weekday}`) ?? '08:00'),
        closesAt: String(form.get(`to-${weekday}`) ?? '19:00'),
      })),
      deps,
    )
  } catch (error) {
    if (error instanceof z.ZodError) return { error: zodMessage(error) }
    throw error
  }
  return { ok: 'Horários salvos.' }
}

export async function rulesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const deps = await actorDeps()
  const n = (k: string) => Number(form.get(k))
  try {
    await saveRules(
      getDb(),
      {
        manualConfirmation: form.get('manualConfirmation') === 'on',
        bookingsPaused: form.get('bookingsPaused') === 'on',
        pendingExpiryHours: n('pendingExpiryHours'),
        minNoticeHours: n('minNoticeHours'),
        horizonDays: n('horizonDays'),
        cancelWindowHours: n('cancelWindowHours'),
        bufferMin: n('bufferMin'),
        slotStepMin: n('slotStepMin'),
        lunchEnabled: form.get('lunchEnabled') === 'on',
        lunchStart: String(form.get('lunchStart') ?? '12:30'),
        lunchEnd: String(form.get('lunchEnd') ?? '13:30'),
        readyBeforeEventMin: n('readyBeforeEventMin'),
        recommendedMarginMin: n('recommendedMarginMin'),
        maxPendingPerContact: n('maxPendingPerContact'),
        travelMinFeeCents: parseMoney(form.get('travelMinFee')),
        travelPerKmCents: parseMoney(form.get('travelPerKm')),
        travelMaxRadiusKm: n('travelMaxRadiusKm'),
        travelSafetyFactor: Number(
          String(form.get('travelSafetyFactor') ?? '1.3').replace(',', '.'),
        ),
      },
      deps,
    )
  } catch (error) {
    if (error instanceof z.ZodError) return { error: zodMessage(error) }
    throw error
  }
  return { ok: 'Regras salvas.' }
}

export async function baseAddressAction(_prev: FormState, form: FormData): Promise<FormState> {
  const deps = await actorDeps()
  const cep = String(form.get('cep') ?? '').replace(/\D/g, '')
  if (cep.length !== 8) return { error: 'Informe um CEP com 8 dígitos.' }
  const r = await saveBaseAddress(
    getDb(),
    { cep, number: String(form.get('number') ?? '') },
    { ...deps, keyRing: getKeyRing(), lookup: getCepLookup() },
  )
  if (!r.ok) {
    return {
      error:
        r.reason === 'cep-not-found'
          ? 'CEP não encontrado.'
          : 'Esse CEP não tem localização no serviço de CEP. Tente o CEP de uma rua próxima.',
    }
  }
  revalidatePath('/admin/ajustes')
  return { ok: `Endereço de saída salvo: ${r.address}` }
}
