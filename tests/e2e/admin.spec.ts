import { createHmac } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import {
  chooseFirstSlot,
  chooseServiceAndPlace,
  emailsTo,
  fillData,
  type SavedEmail,
} from './booking-helpers'
import { E2E_ADMIN_PASSWORD, E2E_ADMINS } from './global-setup'

test.skip(process.env.BOOKING_E2E !== '1', 'set BOOKING_E2E=1 with a database to run')
test.describe.configure({ mode: 'serial' })

/** RFC 6238 code, independent from the app's implementation. */
function totp(base32: string, offsetSteps = 0): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of base32.replace(/\s/g, ''))
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps))
  const mac = createHmac('sha1', key).update(counter).digest()
  const o = mac[19]! & 0xf
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()

async function bookOnline(page: Page, dayIndex: number) {
  await chooseServiceAndPlace(page)
  await chooseFirstSlot(page, dayIndex)
  const who = await fillData(page)
  await page.getByLabel(/Li e aceito a política de cancelamento/).check()
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page).toHaveURL(/minha-agenda\?novo=1$/)
  return who
}

async function login(page: Page, email: string, password = E2E_ADMIN_PASSWORD) {
  await page.goto('/admin/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

let secret = ''

test('painel: login, 2FA no primeiro acesso, confirmar e recusar pedidos', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000) // walks through every panel screen
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const email = E2E_ADMINS[info.project.name as keyof typeof E2E_ADMINS]
  const base = info.project.name === 'desktop' ? 10 : 14

  // Two requests from the public site (a fresh context: no admin cookie there).
  const site = await (await browser.newContext()).newPage()
  const ana = await bookOnline(site, base)
  const bia = await bookOnline(site, base + 2)

  // Not logged in: the panel sends to the login page.
  await page.goto('/admin/agendamentos')
  await expect(page).toHaveURL(/\/admin\/entrar$/)
  expect((await axe(page)).violations).toEqual([])

  await login(page, email, 'senha errada errada')
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'E-mail ou senha incorretos',
  )

  // First login: set up the authenticator app.
  await login(page, email)
  await expect(page).toHaveURL(/\/admin\/configurar-2fa$/)
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
  expect((await axe(page)).violations).toEqual([])
  secret = (await page.locator('.adm-secret').textContent())!.replace(/\s/g, '')
  await page.getByLabel('Código de 6 dígitos').fill('000000')
  await page.getByRole('button', { name: 'Ativar e continuar' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Código inválido')
  await page.getByLabel('Código de 6 dígitos').fill(totp(secret))
  await page.getByRole('button', { name: 'Ativar e continuar' }).click()
  await expect(
    page.getByRole('list', { name: 'Códigos de recuperação' }).getByRole('listitem'),
  ).toHaveCount(10)
  await page.getByRole('link', { name: 'Já guardei, entrar no painel' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.locator('.adm-hello')).toContainText('Luísa')
  expect((await axe(page)).violations).toEqual([])
  await page.goto('/admin/agendamentos')

  const cookies = await page.context().cookies()
  const session = cookies.find((c) => c.name.endsWith('lsr_admin'))!
  expect(session).toMatchObject({ httpOnly: true, sameSite: 'Strict' })

  // Confirm Ana's request.
  await page.getByRole('searchbox').fill(ana.name)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await page
    .getByRole('link', { name: /^(Ver detalhes de )?LSR-/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { level: 2, name: ana.name })).toBeVisible()
  expect((await axe(page)).violations).toEqual([])
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /\S/ })).toContainText(
    'Agendamento confirmado',
  )
  await expect(page.locator('.adm-detail-head')).toContainText('Confirmado')

  // Decline Bia's request (with the confirmation dialog).
  await page.goto(`/admin/agendamentos?q=${encodeURIComponent(bia.name)}`)
  await page
    .getByRole('link', { name: /^(Ver detalhes de )?LSR-/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Recusar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Sim, recusar' }).click()
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /\S/ })).toContainText(
    'Pedido recusado',
  )
  await expect(page.locator('.adm-detail-head')).toContainText('Cancelado')

  let mails: SavedEmail[] = []
  await expect
    .poll(async () => (mails = await emailsTo(ana.email, /^Agendamento confirmado/)).length)
    .toBe(1)
  await expect
    .poll(async () => (await emailsTo(bia.email, /^Não foi possível confirmar/)).length)
    .toBe(1)
  expect(mails[0]!.text).toMatch(/\/a\/[A-Za-z0-9_-]{43}/)

  // Sign out, then back in with password + code.
  await page.getByLabel(/^Conta de/).click()
  await page.locator('.adm-account-menu').getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/entrar$/)
  await page.goto('/admin/agendamentos')
  await expect(page).toHaveURL(/\/admin\/entrar/)
  await login(page, email)
  await expect(page).toHaveURL(/\/admin\/verificar$/)
  expect((await axe(page)).violations).toEqual([])
  await page.getByLabel('Código de 6 dígitos').fill(totp(secret, 1)) // next step: never a replay
  await page.getByRole('button', { name: 'Verificar e entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  // Agenda: week, month and day views.
  await page.goto('/admin/agenda')
  await expect(page.locator('.adm-grid')).toBeVisible()
  expect((await axe(page)).violations).toEqual([])
  await page.getByRole('link', { name: 'Mês' }).click()
  await expect(page.locator('.adm-month')).toBeVisible()
  expect((await axe(page)).violations).toEqual([])

  // A block over a free day, then removed.
  await page.goto('/admin/agenda/bloqueios')
  expect((await axe(page)).violations).toEqual([])
  await page.getByLabel('De', { exact: true }).fill('2027-03-10')
  await page.getByLabel('Motivo (só você vê)', { exact: true }).fill(`Folga ${info.project.name}`)
  await page.getByRole('button', { name: 'Bloquear' }).click()
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /\S/ })).toContainText(
    'Bloqueio criado',
  )
  await page.getByRole('button', { name: `Remover bloqueio Folga ${info.project.name}` }).click()
  await expect(page.getByText(`Folga ${info.project.name}`)).toHaveCount(0)

  // Manual booking (phone-only client), then reschedule and cancel it.
  await page.goto('/admin/agendamentos/novo')
  expect((await axe(page)).violations).toEqual([])
  await page.getByRole('combobox', { name: /^Serviço/ }).selectOption({ label: 'Maquiagem Social' })
  await page
    .getByLabel('Data', { exact: true })
    .fill(info.project.name === 'desktop' ? '2027-03-11' : '2027-03-12')
  await page.getByLabel('Início da maquiagem', { exact: true }).fill('21:00')
  await page.getByLabel('Nome', { exact: true }).fill('Cliente do WhatsApp')
  await page
    .getByLabel('WhatsApp com DDD', { exact: true })
    .fill(info.project.name === 'desktop' ? '11977770001' : '11977770002')
  await page.getByLabel('CEP', { exact: true }).fill('01310-100')
  await page.getByLabel('Número', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Agendar' }).click()
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /\S/ })).toContainText(
    'Agendamento criado',
  )
  await page.getByRole('button', { name: 'Remarcar' }).click()
  await page.getByLabel('Novo horário', { exact: true }).fill('20:00')
  await page.getByRole('dialog').getByRole('button', { name: 'Remarcar' }).click()
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /\S/ })).toContainText(
    'remarcado',
  )
  await expect(page.locator('.adm-info')).toContainText('20:00')
  await page.getByLabel('Anotações internas', { exact: true }).fill('Cliente indicada pela Ana')
  await page.getByRole('button', { name: 'Salvar anotação' }).click()
  await expect(page.getByText('Anotação salva.')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Sim, cancelar' }).click()
  await expect(page.locator('.adm-detail-head')).toContainText('Cancelado')

  // Clients and settings.
  await page.goto('/admin/clientes')
  await expect(page.getByText('Cliente do WhatsApp').first()).toBeVisible()
  expect((await axe(page)).violations).toEqual([])
  await page.getByText('Cliente do WhatsApp').first().click()
  await expect(page.getByRole('heading', { level: 2, name: 'Cliente do WhatsApp' })).toBeVisible()
  expect((await axe(page)).violations).toEqual([])

  await page.goto('/admin/ajustes')
  expect((await axe(page)).violations).toEqual([])
  await page.getByRole('button', { name: 'Salvar regras' }).click()
  await expect(page.getByText('Regras salvas.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar horários' }).click()
  await expect(page.getByText('Horários salvos.')).toBeVisible()
})

test('painel: rotas do painel exigem sessão e não são indexadas', async ({ request }) => {
  const r = await request.get('/admin/agendamentos', { maxRedirects: 0 })
  expect([303, 307, 302]).toContain(r.status())
  const login = await request.get('/admin/entrar')
  expect(login.headers()['x-robots-tag']).toContain('noindex')
  expect(login.headers()['content-security-policy']).toMatch(/'nonce-/)
  const reset = await request.get('/admin/r/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
    maxRedirects: 0,
  })
  expect(reset.headers()['referrer-policy']).toBe('no-referrer')
})
