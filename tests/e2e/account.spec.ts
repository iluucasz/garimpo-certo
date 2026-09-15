import { expect, test } from '@playwright/test'

test('conta preserva erros ao salvar e volta à loja ao sair', async ({ page }) => {
  let name = 'Marina Costa'
  let authenticated = true
  let rejectUpdate = true
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))
  await page.route('**/api/auth/get-session**', (route) => route.fulfill({ json: authenticated ? {
    user: { id: 'account-test', name, email: 'account@example.com', emailVerified: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    session: { id: 'account-session', userId: 'account-test', token: 'browser-test-only', expiresAt: '2099-01-01T00:00:00Z' },
  } : null }))
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: { data: { roles: [] } } }))
  await page.route('**/api/v1/wishlist', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/auth/update-user', (route) => {
    if (rejectUpdate) return route.fulfill({ status: 400, json: { code: 'UPDATE_REJECTED', message: 'Não foi possível atualizar o perfil.' } })
    name = route.request().postDataJSON().name
    return route.fulfill({ json: { status: true } })
  })
  await page.route('**/api/auth/sign-out', (route) => {
    authenticated = false
    return route.fulfill({ json: { success: true } })
  })

  await page.goto('/conta')
  await expect(page.getByRole('heading', { name: 'Seu Garimpo.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Seu nome', exact: true }).fill('  Marina Souza  ')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.locator('#perfil').getByRole('alert')).toContainText('Não foi possível atualizar o perfil.')
  await expect(page.getByRole('textbox', { name: 'Seu nome', exact: true })).toHaveValue('  Marina Souza  ')
  await expect(page.getByText('Seu perfil foi atualizado.')).toHaveCount(0)
  rejectUpdate = false
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.locator('#perfil').getByRole('status')).toHaveText('Seu perfil foi atualizado.')
  expect(name).toBe('Marina Souza')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page).toHaveURL(/:\d+\/$/)
  await expect(page.getByRole('heading', { name: 'Bons produtos. Preços que valem.' })).toBeVisible()
  await page.goto('/conta')
  await expect(page).toHaveURL(/\/entrar$/)
})
