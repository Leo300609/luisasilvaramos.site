import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, type Page } from '@playwright/test'

/** Shared steps of the public booking flow (used by booking and admin specs). */
let seq = 0
export function contact() {
  seq += 1
  const n = `${Date.now()}`.slice(-6) + String(seq).padStart(2, '0')
  return { name: `Cliente Teste ${n}`, phone: `119${n}`, email: `teste${n}@exemplo.com` }
}

export async function chooseServiceAndPlace(page: Page, cep = '01310-100') {
  await page.goto('/agendar')
  await page.getByRole('radio', { name: /Maquiagem Social/ }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Evento e')
  await page.getByLabel('Horário de início do evento').fill('19:00')
  await page.getByLabel('Quanto tempo dura o evento').selectOption('4_6h')
  await page.getByLabel('CEP').fill(cep)
  await page.getByLabel('Número', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Calcular deslocamento' }).click()
}

/** dayIndex > 0 skips the first available days (online changes need 48 h of notice). */
export async function chooseFirstSlot(page: Page, dayIndex = 0) {
  await expect(page.getByText(/Deslocamento: R\$/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  const days = page.locator('.app-day:not([disabled])')
  // Wait for the month to load, then move forward until enough free days are listed.
  await expect(page.getByRole('group', { name: /^Dias de/ })).toBeVisible()
  for (let i = 0; i < 3 && (await days.count()) <= dayIndex; i++) {
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(page.getByRole('group', { name: /^Dias de/ })).toBeVisible()
  }
  const day = days.nth((await days.count()) > dayIndex ? dayIndex : 0)
  await expect(day).toBeVisible()
  await day.click()
  const slot = page
    .getByRole('radiogroup', { name: 'Horários disponíveis' })
    .getByRole('radio')
    .first()
  await expect(slot).toBeVisible()
  const label = (await slot.textContent()) ?? ''
  await slot.click()
  return label.slice(0, 5)
}

export type SavedEmail = { to: string; subject: string; text: string }

/** E-mails the local server wrote to `.emails/` (FileMailer), newest first. */
export async function emailsTo(address: string, subject: RegExp): Promise<SavedEmail[]> {
  const dir = path.join(process.cwd(), '.emails')
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'))
  const all = await Promise.all(
    files
      .sort()
      .reverse()
      .map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))),
  )
  return (all as SavedEmail[]).filter((m) => m.to === address && subject.test(m.subject))
}

/** Path of the "Minha agenda" link (the site URL in e-mails may differ from the test server). */
export const linkIn = (email: SavedEmail) =>
  new URL(/https?:\/\/\S+\/a\/[A-Za-z0-9_-]{43}/.exec(email.text)![0]).pathname

export async function fillData(page: Page, who = contact()) {
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome completo').fill(who.name)
  await page.getByLabel('WhatsApp com DDD').fill(who.phone)
  await page.getByLabel('E-mail').fill(who.email)
  await page.getByRole('button', { name: 'Continuar' }).click()
  return who
}
