import { expect,test } from '@playwright/test'
test('home abre detalhes pelo card e compra direta pelo botão', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Achados para conhecer.' })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="home-categories-title"] a').first()).toBeVisible()
  const card = page.locator('.product-card').first()
  const productName = await card.locator('h3').innerText()
  await expect(card.locator('.product-buy-button')).toHaveAttribute('href', /^https:\/\//)
  await expect(card.locator('.product-buy-button')).toHaveAttribute('target', '_blank')
  const offerUrl = await card.locator('.product-buy-button').getAttribute('href')
  await expect(card.locator('.product-buy-button')).toHaveText('Comprar agora')
  await expect(card.locator('.product-sold-count')).toHaveText(/vendidos?$/)
  await expect(card.locator('.product-card-link')).toHaveAttribute('href', /^\/produto\//)
  await expect(card.getByText('Ver detalhes', { exact: true })).toHaveCount(0)
  await context.route(offerUrl!, route => route.fulfill({ body: 'Oferta da loja' }))
  const buyPopupPromise = page.waitForEvent('popup')
  await card.locator('.product-buy-button').click()
  const buyPopup = await buyPopupPromise
  await expect(buyPopup).toHaveURL(offerUrl!)
  await buyPopup.close()
  await expect(page).toHaveURL(/:\d+\/$/)
  await card.getByRole('button', { name: /aos favoritos/ }).click()
  await expect(card.getByRole('button', { name: /dos favoritos/ })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: /ao comparador/ }).click()
  await expect(card.getByRole('button', { name: /do comparador/ })).toHaveAttribute('aria-pressed', 'true')
  await card.locator('.product-card-link').click()
  await expect(page).toHaveURL(/\/produto\//)
  await expect(page.getByRole('heading', { name: productName, exact: true }).first()).toBeVisible()
})

test('busca encontra um produto real do catálogo e abre a oferta', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
  await page.goto('/')
  const nome = await page.locator('.product-card h3').first().innerText()
  const termo = nome.split(/\s+/).slice(0, 2).join(' ')
  await page.goto('/buscar')
  const campo = page.getByLabel('Buscar no catálogo').last()
  await campo.fill(termo)
  await campo.press('Escape')
  const card = page.locator('.product-card').filter({ hasText: termo }).first()
  await expect(card).toBeVisible()
  await expect(card.locator('.product-buy-button')).toHaveAttribute('href', /^https:\/\/s\.shopee\.com\.br\//)
  await card.locator('.product-card-link').click()
  await expect(page).toHaveURL(/\/produto\//)
  await expect(page.getByRole('link', { name: /Comprar na/ })).toHaveAttribute('href', /^https:\/\//)
})

test('admin exige sessão com papel para abrir um módulo', async ({ page }) => {
  const session = {
    user: { id: 'admin-test', name: 'Admin Teste', email: 'admin@example.com', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    session: { id: 'admin-session', userId: 'admin-test', token: 'browser-test-only', expiresAt: '2099-01-01T00:00:00Z' },
  }
  let roles: unknown[] = []
  await page.route('**/api/auth/get-session**', (route) => route.fulfill({ json: session }))
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: { data: { roles } } }))
  await page.goto('/admin/produtos')
  await expect(page).toHaveURL(/\/$/)

  roles = [{ code: 'ADMIN', permissions: ['catalog:read', 'catalog:write'] }]
  await page.goto('/admin/produtos')
  await expect(page.getByRole('button', { name: /Novo produto/ })).toBeVisible()
})
