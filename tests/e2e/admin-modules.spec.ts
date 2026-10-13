import { expect, test } from '@playwright/test'
import { adminConfigs } from '@/lib/admin-config'
import { createAdminSession, removeUsers } from './helpers/admin-session'

/**
 * Percorre o painel inteiro com um proprietário de verdade (conta criada no Better Auth, papel no banco).
 * Em cada módulo confere: abre sem erro de execução, mostra o título, não cai em estado de falha e não cria
 * rolagem horizontal na página (no celular, é onde o painel mais costuma quebrar).
 */
const created: string[] = []

test.afterAll(async () => { await removeUsers(created.splice(0)) })

const modules = [{ slug: '', title: 'Visão geral' }, ...adminConfigs.map((item) => ({ slug: item.slug, title: item.title }))]

for (const module of modules) {
  test(`painel › ${module.title}`, async ({ page, context }, info) => {
    const session = await createAdminSession('OWNER')
    created.push(session.userId)
    await session.apply(context)
    await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      // Recursos externos (imagens do catálogo, fontes) podem falhar sem relação com o painel.
      if (/Failed to load resource|net::ERR|favicon/i.test(text)) return
      errors.push(text)
    })

    await page.goto(module.slug ? `/admin/${module.slug}` : '/admin')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForLoadState('networkidle')

    // Sem sessão o painel redireciona para o login (que também tem um h1): garante que a sessão valeu de fato.
    expect(new URL(page.url()).pathname, `redirecionado em ${module.slug || '/admin'}`).toMatch(/^\/admin/)

    // Nada de tela de falha ou de acesso negado para o proprietário.
    await expect(page.getByText('Acesso restrito')).toHaveCount(0)
    await expect(page.getByText(/Não foi possível carregar/)).toHaveCount(0)

    // Sem rolagem horizontal na página (tabelas largas rolam dentro do próprio quadro).
    const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(overflow.scroll, `rolagem horizontal em ${module.slug || '/admin'} (${info.project.name})`).toBeLessThanOrEqual(overflow.client + 1)

    expect(errors, `erros no console em ${module.slug || '/admin'}`).toEqual([])
  })
}
