import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('Fundação', () => {
  test('a página inicial carrega em pt-BR, com título e WhatsApp', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Realce a sua')
    const whatsapp = page.getByRole('link', { name: /whatsapp/i })
    await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/5511930546322\?text=/)
    await expect(whatsapp).toHaveAttribute('rel', /noopener/)
  })

  test('a página inicial não gera erros no console (ex.: bloqueios de CSP)', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('a página inicial não tem violações de acessibilidade (axe, WCAG 2.1 AA)', async ({
    page,
  }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('páginas públicas recebem os cabeçalhos de segurança', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['strict-transport-security']).toContain('max-age=63072000')
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('áreas dinâmicas recebem CSP com nonce único e noindex', async ({ request }) => {
    const first = await request.get('/admin')
    const second = await request.get('/admin')
    const csp1 = first.headers()['content-security-policy'] ?? ''
    const csp2 = second.headers()['content-security-policy'] ?? ''
    expect(csp1).toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
    expect(csp1).not.toContain("'unsafe-inline'; img-src")
    expect(csp1).not.toEqual(csp2)
    expect(first.headers()['x-robots-tag']).toContain('noindex')
    expect(first.headers()['cache-control']).toContain('no-store')
  })

  test('links com token não vazam pelo Referer', async ({ request }) => {
    const response = await request.get('/a/qualquer-token')
    expect(response.headers()['referrer-policy']).toBe('no-referrer')
    expect(response.headers()['x-robots-tag']).toContain('noindex')
  })

  test('health check responde sem cache', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('no-store')
    expect(await response.json()).toMatchObject({ status: 'ok' })
  })

  test('robots.txt bloqueia indexação antes do go-live', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toMatch(/Disallow: \/\s*$/m)
  })

  test('404 amigável, com link para o início', async ({ page }) => {
    const response = await page.goto('/pagina-que-nao-existe')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página não encontrada')
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })
})
