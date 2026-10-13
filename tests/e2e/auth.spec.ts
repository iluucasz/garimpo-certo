import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session**', (route) => route.fulfill({ json: null }))
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
})

test('nova senha sem token ou com link expirado pede um novo link', async ({ page }) => {
  await page.goto('/redefinir-senha')
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute('href', '/recuperar-senha')
  await page.goto('/redefinir-senha?token=abc&error=INVALID_TOKEN')
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado.' })).toBeVisible()
})

test('nova senha recusa senhas diferentes e mostra o erro do servidor', async ({ page }) => {
  await page.route('**/api/auth/reset-password', (route) => route.fulfill({ status: 400, json: { code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.' } }))
  await page.goto('/redefinir-senha?token=abc')
  await expect(page.getByRole('heading', { name: 'Escolha uma nova senha.' })).toBeVisible()
  await page.locator('input[name=password]').fill('senha-nova-123')
  await page.locator('input[name=confirmation]').fill('outra-senha-456')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('As senhas não são iguais')

  await page.locator('input[name=confirmation]').fill('senha-nova-123')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('Token inválido ou expirado.')
})

test('nova senha conclui e leva para entrar', async ({ page }) => {
  await page.route('**/api/auth/reset-password', (route) => route.fulfill({ json: { status: true } }))
  await page.goto('/redefinir-senha?token=abc')
  await page.locator('input[name=password]').fill('senha-nova-123')
  await page.locator('input[name=confirmation]').fill('senha-nova-123')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByRole('heading', { name: 'Senha atualizada' })).toBeVisible()
  await page.getByRole('link', { name: 'Entrar', exact: true }).first().click()
  await expect(page).toHaveURL(/\/entrar$/)
})

test('recuperar senha registra o pedido e confirma sem revelar se o e-mail existe', async ({ page }) => {
  await page.route('**/api/auth/request-password-reset', (route) => route.fulfill({ json: { status: true } }))
  await page.route('**/api/auth/forget-password', (route) => route.fulfill({ json: { status: true } }))
  await page.goto('/recuperar-senha')
  await page.getByLabel('E-mail').fill('alguem@example.com')
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado')
})
