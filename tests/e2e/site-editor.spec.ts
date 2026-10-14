import { expect, test } from '@playwright/test'
import { like } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { siteDocuments } from '@/lib/db/schema'
import { createAdminSession, removeUsers } from './helpers/admin-session'

/**
 * Editor visual com um proprietário real. A página criada aqui usa um endereço `teste-e2e-…` e é apagada no
 * fim; a home e a "Aparência do site" (documentos reais) só são lidas, nunca gravadas.
 */
const created: string[] = []

test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'O editor é uma ferramenta de computador; o celular só consulta.')

test.afterAll(async () => {
  await removeUsers(created.splice(0))
  await db.delete(siteDocuments).where(like(siteDocuments.key, 'page:teste-e2e-%'))
})

test('monta uma página: adiciona, desfaz, refaz, reordena, publica e abre no site', async ({ page, context }) => {
  const session = await createAdminSession('OWNER')
  created.push(session.userId)
  await session.apply(context)
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))

  const slug = `teste-e2e-${crypto.randomUUID().slice(0, 8)}`
  await page.goto('/admin/home-builder')
  const selector = page.getByRole('combobox', { name: 'Página em edição' })
  await expect(selector).toBeVisible({ timeout: 20_000 })

  // Cria a página (nasce como rascunho, com um bloco de texto).
  await page.getByRole('button', { name: 'Nova página' }).click()
  await page.getByLabel('Título da nova página').fill(slug)
  await page.getByRole('button', { name: 'Criar página' }).click()
  await expect(page.getByRole('combobox', { name: 'Página em edição' })).toHaveValue(`page:${slug}`, { timeout: 20_000 })

  const tree = page.getByRole('complementary', { name: 'Seções da página' })
  const rows = tree.locator('ol li')
  // "Ajustes da página" + o bloco de texto inicial.
  await expect(rows).toHaveCount(2)

  // Biblioteca: busca e adiciona "Perguntas frequentes".
  await tree.getByRole('tab', { name: 'Adicionar' }).click()
  await tree.getByRole('searchbox', { name: 'Buscar componente' }).fill('perguntas')
  await tree.getByRole('button', { name: /Perguntas frequentes/ }).click()
  await expect(rows).toHaveCount(3)

  // Desfazer e refazer pelo teclado.
  await page.keyboard.press('Control+z')
  await expect(rows).toHaveCount(2)
  await page.keyboard.press('Control+Shift+z')
  await expect(rows).toHaveCount(3)

  // Arrastar "Perguntas frequentes" para antes do texto.
  const faqRow = rows.filter({ hasText: 'Perguntas frequentes' })
  const textRow = rows.filter({ hasText: 'Texto' }).first()
  // Arrasto com o mouse em passos: o dragTo direto às vezes solta antes de o navegador abrir o arrasto com a máquina ocupada.
  const grip = await faqRow.locator('span[class*="grip"]').boundingBox()
  const target = await textRow.boundingBox()
  if (!grip || !target) throw new Error('Linhas da lista não encontradas para arrastar.')
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 4, grip.y + 4, { steps: 4 })
  await page.mouse.move(target.x + 60, target.y + 4, { steps: 16 })
  await page.mouse.up()
  await expect(rows.nth(1)).toContainText('Perguntas frequentes')

  // O salvamento automático grava o rascunho.
  await expect(page.getByText(/Rascunho salvo/)).toBeVisible({ timeout: 15_000 })

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Publicado. A página já está no ar.')).toBeVisible({ timeout: 20_000 })

  // A página abre para qualquer visitante.
  const visitor = await context.browser()!.newContext()
  const publicPage = await visitor.newPage()
  await publicPage.goto(`/paginas/${slug}`)
  await expect(publicPage.getByRole('heading', { level: 2, name: 'Perguntas frequentes' })).toBeVisible()
  await visitor.close()
})

test('clicar numa seção da prévia seleciona a seção na lista', async ({ page, context }) => {
  const session = await createAdminSession('OWNER')
  created.push(session.userId)
  await session.apply(context)
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))

  await page.goto('/admin/home-builder')
  const tree = page.getByRole('complementary', { name: 'Seções da página' })
  const guidesRow = tree.locator('button[class*="pick"]').filter({ hasText: 'Guias de compra' })
  await expect(guidesRow).toBeVisible({ timeout: 20_000 })

  const preview = page.frameLocator('iframe[title^="Prévia da página"]')
  const guides = preview.locator('[data-cms-section="guides"]')
  await expect(guides).toBeAttached({ timeout: 30_000 })
  // O editor liga o clique da prévia quando a página termina de carregar; clicar antes disso não seleciona nada.
  await expect(preview.locator('#cms-editor-style')).toBeAttached({ timeout: 30_000 })
  await guides.scrollIntoViewIfNeeded()
  await guides.click({ position: { x: 8, y: 8 }, force: true })

  await expect(guidesRow).toHaveAttribute('aria-current', 'true')
  // O formulário da seção aparece no painel de ajustes.
  await expect(page.getByRole('complementary', { name: 'Ajustes' }).getByRole('heading', { name: 'Guias de compra' })).toBeVisible()
})

test('"Aparência do site" abre tema, aviso do topo e rodapé sem alterar nada', async ({ page, context }) => {
  const session = await createAdminSession('OWNER')
  created.push(session.userId)
  await session.apply(context)
  await page.addInitScript(() => localStorage.setItem('garimpo:consent', 'false'))

  await page.goto('/admin/home-builder')
  await page.getByRole('combobox', { name: 'Página em edição' }).selectOption('global')
  const inspector = page.getByRole('complementary', { name: 'Ajustes' })
  await expect(inspector.getByRole('heading', { name: 'Tema' })).toBeVisible({ timeout: 20_000 })
  await expect(inspector.getByText(/Contraste de/)).toBeVisible()

  await page.getByRole('complementary', { name: 'Áreas da aparência' }).getByRole('button', { name: /Rodapé/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Rodapé' })).toBeVisible()
  await expect(inspector.getByLabel('Frase de apresentação')).not.toHaveValue('')
})
