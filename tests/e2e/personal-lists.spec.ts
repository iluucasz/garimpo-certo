import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session**', (route) => route.fulfill({ json: null }))
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
})

test('favoritos permite salvar, retomar e remover uma escolha', async ({ page }) => {
  await page.goto('/favoritos')
  await expect(page.getByRole('heading', { name: 'Sua seleção começa aqui.' })).toBeVisible()
  const card = page.locator('.product-card').first()
  const name = await card.locator('h3').innerText()
  await card.getByRole('button', { name: /aos favoritos/ }).click()
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.product-card').getByRole('heading', { name })).toBeVisible()
  await page.locator('.product-card').getByRole('button', { name: /dos favoritos/ }).click()
  await expect(page.getByRole('heading', { name: 'Sua seleção começa aqui.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sua seleção começa aqui.' })).toBeVisible()
})

test('comparador mantém a seleção e limita a adição a quatro produtos', async ({ page }) => {
  await page.goto('/comparar')
  const picker = page.getByRole('combobox', { name: 'Adicionar produto' })
  await expect(picker).toBeEnabled()
  const ids = await picker.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean).slice(0, 4))
  expect(ids).toHaveLength(4)
  for (const id of ids) await picker.selectOption(id)
  await expect(picker).toBeDisabled()
  await expect(page.getByRole('button', { name: /do comparador/ })).toHaveCount(4)
  await page.reload()
  await expect(page.getByRole('button', { name: /do comparador/ })).toHaveCount(4)
  await page.getByRole('button', { name: /do comparador/ }).first().click()
  await expect(picker).toBeEnabled()
  await expect(page.getByRole('button', { name: /do comparador/ })).toHaveCount(3)
})

test('histórico guarda o produto aberto e permite limpar', async ({ page }) => {
  await page.goto('/historico')
  await expect(page.getByRole('heading', { name: 'Nada visto por enquanto.' })).toBeVisible()
  await page.goto('/')
  const name = await page.locator('.product-card h3').first().innerText()
  await page.locator('.product-card-link').first().click()
  await expect(page).toHaveURL(/\/produto\//)
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('garimpo:recent') ?? '[]').length > 0)
  await page.goto('/historico')
  await expect(page.getByRole('button', { name: 'Limpar histórico' })).toBeVisible()
  await expect(page.locator('.product-card').getByRole('heading', { name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Limpar histórico' }).click()
  await expect(page.getByRole('heading', { name: 'Nada visto por enquanto.' })).toBeVisible()
})

test('medição só envia eventos de uso depois da permissão', async ({ page }) => {
  const events: string[] = []
  await page.route('**/api/v1/events', (route) => { events.push(route.request().url()); return route.fulfill({ json: { data: {} } }) })
  await page.goto('/')
  const card = page.locator('.product-card').first()
  await card.getByRole('button', { name: /aos favoritos/ }).click()
  await expect(card.getByRole('button', { name: /dos favoritos/ })).toBeVisible()
  await page.waitForTimeout(400)
  expect(events).toHaveLength(0)

  await page.evaluate(() => localStorage.setItem('garimpo:cookie-preferences', JSON.stringify({ essential: true, analytics: true, personalization: false, marketing: false })))
  await card.getByRole('button', { name: /dos favoritos/ }).click()
  await expect.poll(() => events.length).toBeGreaterThan(0)
})

test('aba "Para você" só aparece com personalização permitida e interesses salvos', async ({ page }) => {
  const forYou = page.getByRole('link', { name: 'Para você' })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Em alta' })).toBeVisible()
  await expect(forYou).toHaveCount(0)

  // Personalização permitida, mas interesses nunca salvos: valores padrão não contam como escolha.
  await page.evaluate(() => localStorage.setItem('garimpo:cookie-preferences', JSON.stringify({ essential: true, analytics: false, personalization: true, marketing: false })))
  await page.reload()
  await expect(page.getByRole('link', { name: 'Em alta' })).toBeVisible()
  await expect(forYou).toHaveCount(0)

  await page.evaluate(() => localStorage.setItem('garimpo:user-preferences', JSON.stringify({ categories: ['Cozinha'], maxPrice: 1500, notifications: true, newsletter: false })))
  await page.reload()
  await expect(forYou).toBeVisible()
  await forYou.click()
  await expect(page.locator('.product-card').first()).toBeVisible()
  expect(await page.locator('.product-card').count()).toBeGreaterThan(0)

  await page.evaluate(() => localStorage.setItem('garimpo:cookie-preferences', JSON.stringify({ essential: true, analytics: false, personalization: false, marketing: false })))
  await page.reload()
  await expect(forYou).toHaveCount(0)
})

test('clique em "Comprar" só é registrado com a medição permitida e nunca bloqueia a compra', async ({ page }) => {
  const clicks: unknown[] = []
  await page.route('**/api/v1/outbound-clicks', (route) => {
    if (route.request().method() === 'POST') clicks.push(route.request().postDataJSON())
    return route.fulfill({ status: 201, json: { data: { clickId: 'clk_teste' } } })
  })
  // Impede a navegação real para a Shopee durante o teste.
  await page.route('https://**/*', (route) => route.request().resourceType() === 'document' ? route.fulfill({ body: '<html></html>', contentType: 'text/html' }) : route.continue())

  await page.goto('/')
  const buy = page.locator('.product-buy-button').first()
  await expect(buy).toHaveAttribute('data-offer-id', /^[0-9a-f-]{36}$/)
  await buy.click()
  await page.bringToFront()
  await page.waitForTimeout(300)
  expect(clicks).toHaveLength(0)

  await page.evaluate(() => localStorage.setItem('garimpo:cookie-preferences', JSON.stringify({ essential: true, analytics: true, personalization: false, marketing: false })))
  await buy.click()
  await expect.poll(() => clicks.length).toBe(1)
  expect(clicks[0]).toMatchObject({ slot: 'product-card' })
})
