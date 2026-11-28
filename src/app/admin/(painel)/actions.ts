'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { confirmBooking, declineBooking } from '@/server/admin/bookings'
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
