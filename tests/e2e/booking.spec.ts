import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Needs a database with services and the base location (see CI "build-e2e").
test.skip(process.env.BOOKING_E2E !== '1', 'set BOOKING_E2E=1 with a database to run')
test.describe.configure({ mode: 'serial' })

let seq = 0
function contact() {
  seq += 1
  const n = `${Date.now()}`.slice(-6) + String(seq).padStart(2, '0')
  return { name: `Cliente Teste ${n}`, phone: `119${n}`, email: `teste${n}@exemplo.com` }
}

async function chooseServiceAndPlace(page: Page, cep = '01310-100') {
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
async function chooseFirstSlot(page: Page, dayIndex = 0) {
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

async function fillData(page: Page, who = contact()) {
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome completo').fill(who.name)
  await page.getByLabel('WhatsApp com DDD').fill(who.phone)
  await page.getByLabel('E-mail').fill(who.email)
  await page.getByRole('button', { name: 'Continuar' }).click()
  return who
}

test('agendamento completo: 5 passos → Minha agenda → .ics → cancelar', async ({ page }) => {
  await chooseServiceAndPlace(page)
  const time = await chooseFirstSlot(page, 4)
  const who = await fillData(page)

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Revise e')
  await expect(page.getByText(who.email)).toBeVisible()
  const confirm = page.getByRole('button', { name: 'Confirmar agendamento' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel(/Li e aceito a política de cancelamento/).check()
  await confirm.click()

  await expect(page).toHaveURL(/\/agendar\/minha-agenda\?novo=1$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pedido recebido!')
  await expect(page.locator('.app-status')).toHaveText('Aguardando confirmação')
  await expect(page.getByText(/#LSR-\d{4}/)).toBeVisible()
  await expect(page.locator('.app-big-time')).toHaveText(time)

  const ics = await page.request.get('/api/agendamento/minha/ics')
  expect(ics.headers()['content-type']).toContain('text/calendar')
  expect(await ics.text()).toContain('BEGIN:VEVENT')

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  await page.getByRole('button', { name: 'Cancelar agendamento' }).click()
  await page.getByRole('button', { name: 'Sim, cancelar' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agendamento cancelado')
})

test('duas clientes no mesmo horário: a segunda vê "acabou de ser reservado" e mantém os dados', async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  // A full working day (index 2) so the second client still has other times left.
  for (const page of [a, b]) {
    await chooseServiceAndPlace(page)
    await chooseFirstSlot(page, 2)
  }
  const whoA = await fillData(a)
  const whoB = await fillData(b)
  await a.getByLabel(/Li e aceito/).check()
  await b.getByLabel(/Li e aceito/).check()

  await a.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(a).toHaveURL(/minha-agenda/)

  await b.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(b.locator('.app-notice[role="alert"]')).toContainText(
    'Esse horário acabou de ser reservado',
  )
  await expect(b.getByRole('heading', { level: 1 })).toContainText('Data e')
  // Data preserved: pick another slot and the form still has her name.
  await b
    .getByRole('radiogroup', { name: 'Horários disponíveis' })
    .getByRole('radio')
    .first()
    .click()
  await b.getByRole('button', { name: 'Continuar' }).click()
  await expect(b.getByLabel('Nome completo')).toHaveValue(whoB.name)
  expect(whoA.name).not.toBe(whoB.name)
})

test('erros: CEP não encontrado, fora da região e validação dos dados', async ({ page }) => {
  await chooseServiceAndPlace(page, '99999-999')
  await expect(page.locator('.app-notice[role="alert"]')).toContainText('Não encontramos esse CEP')
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled()

  await page.getByLabel('CEP').fill('88888-888')
  await page.getByRole('button', { name: 'Calcular deslocamento' }).click()
  await expect(page.locator('.app-notice[role="alert"]')).toContainText('fora da região')

  await page.getByLabel('CEP').fill('01310-100')
  await page.getByRole('button', { name: 'Calcular deslocamento' }).click()
  await chooseFirstSlot(page)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByLabel('Nome completo')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Nome completo')).toBeFocused()
  await expect(page.getByText('Informe um WhatsApp válido com DDD.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido, como nome@email.com.')).toBeVisible()

  await page.getByLabel('Alergias ou sensibilidades (opcional)').fill('látex')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Para registrar alergias, marque a autorização acima.')).toBeVisible()
})

test('serviço pré-selecionado pelo card do site e acessibilidade do passo 1', async ({ page }) => {
  // Measure contrast on the final colours, not mid entrance animation.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/agendar?servico=noiva')
  await expect(page.getByRole('radio', { name: /Maquiagem para Noivas/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('Minha agenda sem link mostra a orientação, e link inválido também', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/agendar/minha-agenda')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agendamento não encontrado')
  await page.goto('/a/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
  await expect(page).toHaveURL(/link=invalido/)
  await expect(page.getByText(/link expirou/)).toBeVisible()
})

test('APIs recusam requisições de outra origem (CSRF)', async ({ request }) => {
  const r = await request.post('/api/agendamento', {
    data: {},
    headers: { origin: 'https://site-malicioso.example' },
  })
  expect(r.status()).toBe(403)
})
