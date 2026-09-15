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
