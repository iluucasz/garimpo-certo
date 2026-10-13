import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
})

test('coleções e guias reais aparecem no menu, na home e no rodapé', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href="/colecoes"]').first()).toBeAttached()
  await expect(page.locator('a[href="/guias"]').first()).toBeAttached()
  await expect(page.locator('a[href*="#colecoes"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Escolha pelo que importa.' })).toBeVisible()
  await expect(page.locator('a[href^="/colecoes/"]').first()).toBeVisible()
})

test('home montada pelo editor mostra o topo, a vitrine e as seções internas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#ofertas')).toBeAttached()
  await expect(page.getByRole('heading', { name: 'Escolha pelo que importa.' })).toBeVisible()
})

test('prévia do rascunho (?preview=1) é ignorada para quem não está no painel', async ({ page }) => {
  await page.goto('/?preview=1')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Prévia do rascunho')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
})

test('coleção abre com produtos reais e critério explicado', async ({ page }) => {
  await page.goto('/colecoes')
  await expect(page.getByRole('heading', { name: 'Coleções', exact: true })).toBeVisible()
  await page.locator('a[href^="/colecoes/"]').first().click()
  await expect(page).toHaveURL(/\/colecoes\/[a-z0-9-]+$/)
  await expect(page.locator('.product-card').first()).toBeVisible()
  await expect(page.getByText(/produtos? com/).first()).toBeVisible()
  await expect(page.locator('.product-buy-button').first()).toHaveAttribute('href', /^https:\/\//)
})

test('guia mostra dados do catálogo e destaques sem repetir produto', async ({ page }) => {
  await page.goto('/guias')
  await page.locator('a[href^="/guias/"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Guia de compra:')
  await expect(page.getByText('Faixa de preço')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que observar antes de comprar' })).toBeVisible()
  const links = await page.locator('.product-card-link').evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href')))
  expect(links.length).toBeGreaterThan(0)
  expect(new Set(links).size).toBe(links.length)
})

test('rotas editoriais inexistentes e páginas inexistentes respondem 404 de verdade', async ({ request }) => {
  for (const path of ['/guias/nao-existe', '/colecoes/nao-existe', '/produto/nao-existe-xyz', '/categorias/nao-existe']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
})

test('sitemap e robots só expõem o que é real', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('/buscar')
  expect(sitemap).toContain('/produto/')
  expect(sitemap).toContain('/colecoes/mais-vendidos')
  expect(sitemap).toContain('/guias/')
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

test('busca e categoria já entregam a grade de produtos no HTML', async ({ request }) => {
  for (const path of ['/buscar', '/buscar?q=fone', '/categorias/cozinha']) {
    const html = await (await request.get(path)).text()
    expect(html, path).toContain('product-card')
  }
})

test('parâmetros da URL valem na busca (servidor) e na categoria (estática)', async ({ page }) => {
  await page.goto('/buscar?ordem=menor-preco&sinais=Bem%20avaliados')
  await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('menor-preco')
  await expect(page.getByRole('button', { name: 'Remover filtro Bem avaliados' })).toBeVisible()

  await page.goto('/categorias/cozinha?ordem=avaliacao')
  await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('avaliacao')
})
