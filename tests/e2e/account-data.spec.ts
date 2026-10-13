import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
  await page.route('**/api/auth/get-session**', (route) => route.fulfill({ json: {
    user: { id: 'data-test', name: 'Marina Costa', email: 'marina@example.com', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    session: { id: 'data-session', userId: 'data-test', token: 'browser-test-only', expiresAt: '2099-01-01T00:00:00Z' },
  } }))
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: { data: { roles: [] } } }))
  await page.route('**/api/v1/wishlist', (route) => route.fulfill({ json: { data: [] } }))
})

test('baixar dados da conta gera um arquivo com o perfil', async ({ page }) => {
  await page.route('**/api/v1/me/export', (route) => route.fulfill({ json: { data: { user: { email: 'marina@example.com' }, favorites: [], roles: [] } } }))
  await page.goto('/conta#dados')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar arquivo' }).click()
  expect((await download).suggestedFilename()).toBe('garimpo-minha-conta.json')
})

test('excluir conta pede confirmação, mostra erro de senha e volta ao início ao concluir', async ({ page }) => {
  let reject = true
  await page.route('**/api/auth/delete-user', (route) => reject
    ? route.fulfill({ status: 400, json: { code: 'INVALID_PASSWORD', message: 'Senha incorreta.' } })
    : route.fulfill({ json: { success: true } }))
  await page.goto('/conta#dados')
  await expect(page.getByLabel('Senha da conta')).toHaveCount(0)
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByLabel('Senha da conta').fill('senha-errada')
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('Senha incorreta.')

  reject = false
  await page.route('**/api/auth/get-session**', (route) => route.fulfill({ json: null }))
  await page.getByLabel('Senha da conta').fill('senha-certa-123')
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('cancelar a exclusão fecha o formulário sem chamar o servidor', async ({ page }) => {
  let called = false
  await page.route('**/api/auth/delete-user', (route) => { called = true; return route.fulfill({ json: { success: true } }) })
  await page.goto('/conta#dados')
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByLabel('Senha da conta')).toHaveCount(0)
  expect(called).toBe(false)
})
