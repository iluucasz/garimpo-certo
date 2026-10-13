import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
})

test('coleções e guias de demonstração ficam fora do menu, da home e do rodapé', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href^="/colecoes"], a[href^="/guias"], a[href*="#colecoes"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Vale a leitura.' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Escolha pelo que importa.' })).toBeVisible()
})

test('rotas editoriais e páginas inexistentes respondem 404 de verdade', async ({ request }) => {
  for (const path of ['/guias', '/guias/como-escolher-headphone', '/colecoes/mesa-bem-resolvida', '/produto/nao-existe-xyz', '/categorias/nao-existe']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
})

test('sitemap e robots só expõem o que é real', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('/buscar')
  expect(sitemap).toContain('/produto/')
  expect(sitemap).not.toContain('/colecoes/')
  expect(sitemap).not.toContain('/guias')
  expect(sitemap).not.toContain('garimpo.example')

  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /admin/')
  expect(robots).toContain('Disallow: /api/')
  expect(robots).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/)
  expect(robots).not.toContain('garimpo.example')
})

test('metadados usam o endereço do próprio site, não um domínio fixo', async ({ page }) => {
  await page.goto('/')
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).not.toContain('garimpo.example')
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(jsonLd).not.toContain('garimpo.example')
})
