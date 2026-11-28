import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1100

test.describe('Site público', () => {
  test('mostra todas as seções do design, na ordem', async ({ page }) => {
    await page.goto('/')
    const headings = page.getByRole('heading', { level: 2 })
    await expect(headings).toHaveText([
      /Conheça a Luísa/i,
      /Uma make para cada momento/i,
      /Trabalhos que encantam/i,
      /Do primeiro contato ao resultado/i,
      /O que dizem as clientes/i,
      /Vamos deixar você inesquecível/i,
      /Vamos conversar/i,
    ])
    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(page.getByText('Desenvolvido por')).toBeVisible()
    await expect(page.getByText('Leo Almeida Canto')).toBeVisible()
  })

  test('não oferece serviços removidos (artística, aulas) nem estúdio', async ({ page }) => {
    await page.goto('/')
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toContain('automaquiagem')
    expect(body).not.toContain('editorial')
    expect(body).not.toContain('estúdio')
  })

  test('header fica sólido ao rolar', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header.lsr-header')
    await expect(header).not.toHaveClass(/is-scrolled/)
    await page.mouse.wheel(0, 600)
    await expect(header).toHaveClass(/is-scrolled/)
  })

  test('menu mobile abre, navega e fecha com Esc', async ({ page }) => {
    test.skip(!isMobile(page), 'menu só existe abaixo de 1100px')
    await page.goto('/')
    const burger = page.getByRole('button', { name: 'Abrir menu' })
    await burger.click()
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const menu = page.getByRole('navigation', { name: 'Menu', exact: true })
    await expect(menu.getByRole('link', { name: 'Agendar horário' })).toHaveAttribute(
      'href',
      '/agendar',
    )
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused()

    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page
      .getByRole('navigation', { name: 'Menu', exact: true })
      .getByRole('link', { name: 'Contato' })
      .click()
    await expect(page).toHaveURL(/#contato$/)
    await expect(page.getByRole('navigation', { name: 'Menu', exact: true })).toBeHidden()
  })

  test('lightbox do portfólio: abre, navega pelo teclado e devolve o foco', async ({ page }) => {
    await page.goto('/')
    const tile = page
      .getByRole('button', { name: 'Ampliar foto 01, Noiva' })
      .locator('visible=true')
    await tile.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('01 / 09')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByText('02 / 09')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(dialog.getByText('09 / 09')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(tile).toBeFocused()
  })

  test('carrossel de depoimentos: setas e indicadores', async ({ page }) => {
    await page.goto('/#depoimentos')
    const section = page.locator('#depoimentos')
    await expect(section.getByText('Noiva · [mês/ano]')).toBeVisible()
    await section.getByRole('button', { name: 'Próximo depoimento' }).click()
    await expect(section.getByText('Formatura · [mês/ano]')).toBeVisible()
    await section.getByRole('button', { name: 'Mostrar depoimento 3' }).click()
    await expect(section.getByText('Festa · [mês/ano]')).toBeVisible()
    await expect(section.getByRole('button', { name: 'Mostrar depoimento 3' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await section.getByRole('button', { name: 'Próximo depoimento' }).click()
    await expect(section.getByText('Noiva · [mês/ano]')).toBeVisible()
  })

  test('formulário de contato: erros acessíveis e envio pelo WhatsApp', async ({ page }) => {
    await page.goto('/#contato')
    const form = page.getByRole('form', { name: 'Formulário de contato' })
    await form.getByRole('button', { name: 'Enviar mensagem' }).click()

    const name = form.getByLabel('Nome')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()
    await expect(form.getByText('Informe seu nome.')).toBeVisible()
    await expect(form.getByText('Informe um WhatsApp válido com DDD.')).toBeVisible()
    await expect(form.getByText('Escolha o tipo de evento.')).toBeVisible()

    await name.fill('Maria Souza')
    await form.getByLabel('WhatsApp').pressSequentially('11912345678')
    await expect(form.getByLabel('WhatsApp')).toHaveValue('(11) 91234-5678')
    await form.getByLabel('Tipo de evento').selectOption('Noiva')
    await form.getByLabel('Mensagem').fill('Casamento às 17h & festa')

    // Capture window.open instead of really opening WhatsApp.
    await page.evaluate(() => {
      ;(window as unknown as { __opened: string[] }).__opened = []
      window.open = (url?: string | URL) => {
        ;(window as unknown as { __opened: string[] }).__opened.push(String(url))
        return null
      }
    })
    await form.getByRole('button', { name: 'Enviar mensagem' }).click()
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/5511930546322\?text=/)
    await expect(form.getByRole('status')).toContainText('Abrimos o WhatsApp')
    await expect(form.getByRole('link', { name: 'Clique aqui' })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/5511930546322\?text=.*Maria%20Souza.*Casamento%20%C3%A0s%2017h%20%26%20festa/,
    )
  })

  test('cards de serviço levam ao agendamento com o serviço escolhido', async ({ page }) => {
    await page.goto('/#servicos')
    await expect(page.getByRole('link', { name: 'Agendar Maquiagem para Noivas' })).toHaveAttribute(
      'href',
      '/agendar?servico=noiva',
    )
  })

  test('acessibilidade (axe) com lightbox aberto', async ({ page }) => {
    // Without this, axe can measure contrast mid fade-in (semi-transparent text).
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page
      .getByRole('button', { name: 'Ampliar foto 02, Social' })
      .locator('visible=true')
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('não há rolagem horizontal', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('SEO: JSON-LD, canonical, Open Graph e sitemap', async ({ page, request }) => {
    await page.goto('/')
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    )
    expect(jsonLd['@type']).toBe('BeautySalon')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https?:\/\/[^/]+\/?$/,
    )
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /opengraph-image/,
    )
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain('/agendar')
    expect(sitemap).not.toContain('/admin')
    const og = await request.get('/opengraph-image')
    expect(og.headers()['content-type']).toBe('image/png')
  })
})

test.describe('Agendar (provisório)', () => {
  test('página dinâmica com nonce, indexável e com saída para o WhatsApp', async ({
    page,
    request,
  }) => {
    const response = await request.get('/agendar')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-security-policy']).toMatch(/'nonce-[^']+' 'strict-dynamic'/)
    expect(response.headers()['x-robots-tag']).toBeUndefined()

    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('/agendar')
    if (process.env.BOOKING_E2E === '1') {
      // With a database configured the real booking flow is shown (tests/e2e/booking.spec.ts).
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Escolha o')
    } else {
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Em breve')
      await expect(page.getByRole('link', { name: 'Chamar no WhatsApp' })).toHaveAttribute(
        'href',
        /wa\.me/,
      )
    }
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})

test.describe('Política de privacidade', () => {
  test('página acessível, ligada pelo rodapé e com os direitos da titular', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Política de privacidade' })
      .click()
    await expect(page).toHaveURL(/\/privacidade$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidade')
    await expect(page.getByRole('heading', { name: 'Seus direitos' })).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
})
