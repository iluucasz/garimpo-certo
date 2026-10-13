import { afterAll, describe, expect, it } from 'vitest'
import { eq, inArray, like } from 'drizzle-orm'
import { GET as listResource, POST as createResource } from '@/app/api/v1/admin/resources/[resource]/route'
import { DELETE as deleteRecord, GET as getRecord, PATCH as patchRecord } from '@/app/api/v1/admin/resources/[resource]/[id]/route'
import { DELETE as resetSetting, GET as getSettingRoute, PUT as putSetting } from '@/app/api/v1/admin/settings/[key]/route'
import { POST as previewSegment } from '@/app/api/v1/admin/segments/preview/route'
import { POST as engagement } from '@/app/api/v1/engagement/route'
import { POST as uploadImage } from '@/app/api/v1/admin/uploads/route'
import { db } from '@/lib/db/client'
import { auditLogs, campaigns, categories, coupons, curatedCollections, globalSettings, productCategories, products, segments, tags } from '@/lib/db/schema'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { createAuthenticatedUser } from '../helpers/auth'

const url = 'http://localhost/api/v1/admin'
const json = (body: unknown, cookie?: string, method = 'POST') => new Request(url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
const plain = (cookie?: string, method = 'GET') => new Request(url, { method, headers: cookie ? { cookie } : {} })
const resource = (name: string) => ({ params: Promise.resolve({ resource: name }) })
const record = (name: string, id: string) => ({ params: Promise.resolve({ resource: name, id }) })
const setting = (key: string) => ({ params: Promise.resolve({ key }) })
const unique = () => crypto.randomUUID().slice(0, 8)

const createdProducts: string[] = []
const createdCategories: string[] = []

afterAll(async () => {
  await db.delete(coupons).where(like(coupons.title, 'Teste de contrato%'))
  await db.delete(campaigns).where(like(campaigns.slug, 'teste-contrato-%'))
  await db.delete(curatedCollections).where(like(curatedCollections.slug, 'teste-contrato-%'))
  await db.delete(segments).where(like(segments.name, 'Teste de contrato%'))
  await db.delete(tags).where(like(tags.code, 'teste-contrato-%'))
  if (createdProducts.length) await db.delete(products).where(inArray(products.id, createdProducts))
  if (createdCategories.length) await db.delete(categories).where(inArray(categories.id, createdCategories))
  await db.delete(globalSettings).where(inArray(globalSettings.key, ['slots', 'tracking']))
  await db.delete(auditLogs).where(like(auditLogs.entityId, 'teste-contrato-%'))
})

describe('API do painel', () => {
  it('exige sessão e respeita o papel em cada recurso', async () => {
    resetRateLimits()
    expect((await listResource(plain(), resource('cupons'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    expect((await listResource(plain(reader.cookie), resource('cupons'))).status).toBe(200)
    expect((await createResource(json({ title: 'Teste de contrato', url: 'https://s.shopee.com.br/x' }, reader.cookie), resource('cupons'))).status).toBe(403)
    // Auditoria e usuários exigem users:manage.
    expect((await listResource(plain(reader.cookie), resource('audit-log'))).status).toBe(403)
    expect((await listResource(plain(reader.cookie), resource('usuarios'))).status).toBe(403)
  })

  it('upload de imagem exige sessão e permissão e recusa o que não é imagem', async () => {
    resetRateLimits()
    const form = (content: BlobPart, name = 'arquivo.png', type = 'image/png') => { const data = new FormData(); data.append('file', new File([content], name, { type })); return data }
    const send = (body: FormData, cookie?: string) => uploadImage(new Request('http://localhost/api/v1/admin/uploads', { method: 'POST', headers: cookie ? { cookie } : {}, body }))
    expect((await send(form('x'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    expect((await send(form('x'), reader.cookie)).status).toBe(403)
    const editor = await createAuthenticatedUser('MARKETING')
    // Declara PNG, mas o conteúdo é HTML: tem de ser recusado antes de chegar ao armazenamento.
    const fake = await send(form('<html><script>alert(1)</script></html>'), editor.cookie)
    expect([422, 503]).toContain(fake.status)
    if (fake.status === 422) expect((await fake.json()).error.details.file).toBeTruthy()
  })

  it('recurso desconhecido responde 404', async () => {
    const admin = await createAuthenticatedUser('ADMIN')
    expect((await listResource(plain(admin.cookie), resource('nao-existe'))).status).toBe(404)
  })

  it('cria, edita e apaga um cupom com validação e trilha de auditoria', async () => {
    const admin = await createAuthenticatedUser('ADMIN')
    const invalid = await createResource(json({ title: 'Teste de contrato', url: 'javascript:alert(1)' }, admin.cookie), resource('cupons'))
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error.details.url).toBeTruthy()

    const created = await createResource(json({ title: 'Teste de contrato cupom', code: 'TESTE10', url: 'https://s.shopee.com.br/abc', discountLabel: '10% off', isActive: true }, admin.cookie), resource('cupons'))
    expect(created.status).toBe(201)
    const row = (await created.json()).data
    expect(row.code).toBe('TESTE10')
    expect(row.situation).toBe('No ar')

    const updated = await patchRecord(json({ isActive: false }, admin.cookie, 'PATCH'), record('cupons', row.id))
    expect(updated.status).toBe(200)
    expect((await updated.json()).data.situation).toBe('Oculto')

    const audits = await db.select().from(auditLogs).where(eq(auditLogs.entityId, row.id))
    expect(audits.map((entry) => entry.action).sort()).toEqual(['cupons.create', 'cupons.update'])
    expect(audits[0].actorUserId).toBe(admin.userId)

    expect((await deleteRecord(plain(admin.cookie, 'DELETE'), record('cupons', row.id))).status).toBe(200)
    expect((await getRecord(plain(admin.cookie), record('cupons', row.id))).status).toBe(404)
  })

  it('rejeita período invertido em campanha e destino inseguro', async () => {
    const admin = await createAuthenticatedUser('MARKETING')
    const slug = `teste-contrato-${unique()}`
    const base = { title: 'Campanha de teste', slug, headline: 'Oferta', ctaLabel: 'Ver', status: 'draft' }
    const inverted = await createResource(json({ ...base, ctaUrl: '/colecoes', startsAt: '2026-12-10T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' }, admin.cookie), resource('campanhas'))
    expect(inverted.status).toBe(422)
    const unsafe = await createResource(json({ ...base, ctaUrl: 'javascript:alert(1)' }, admin.cookie), resource('campanhas'))
    expect(unsafe.status).toBe(422)
    const ok = await createResource(json({ ...base, ctaUrl: '/colecoes/viralizou', status: 'active' }, admin.cookie), resource('campanhas'))
    expect(ok.status).toBe(201)
  })

  it('categoria: impede slug repetido e apagar categoria com produtos', async () => {
    const admin = await createAuthenticatedUser('CATALOG_MANAGER')
    const slug = `teste-contrato-${unique()}`
    const created = await createResource(json({ name: 'Categoria de teste', slug, sortOrder: 90 }, admin.cookie), resource('categorias'))
    expect(created.status).toBe(201)
    const category = (await created.json()).data
    createdCategories.push(category.id)
    expect((await createResource(json({ name: 'Outra', slug }, admin.cookie), resource('categorias'))).status).toBe(409)

    const [product] = await db.insert(products).values({ slug: `teste-contrato-${unique()}`, name: 'Produto de teste', status: 'active' }).returning({ id: products.id })
    createdProducts.push(product.id)
    await db.insert(productCategories).values({ productId: product.id, categoryId: category.id, isPrimary: true })
    const blocked = await deleteRecord(plain(admin.cookie, 'DELETE'), record('categorias', category.id))
    expect(blocked.status).toBe(409)
    await db.delete(productCategories).where(eq(productCategories.productId, product.id))
    expect((await deleteRecord(plain(admin.cookie, 'DELETE'), record('categorias', category.id))).status).toBe(200)
  })

  it('editar um produto o protege da importação e ocultar o arquiva', async () => {
    const admin = await createAuthenticatedUser('CATALOG_MANAGER')
    const [product] = await db.insert(products).values({ slug: `teste-contrato-${unique()}`, name: 'Nome original', status: 'active' }).returning({ id: products.id })
    createdProducts.push(product.id)

    const edited = await patchRecord(json({ name: 'Nome do editor' }, admin.cookie, 'PATCH'), record('produtos', product.id))
    expect(edited.status).toBe(200)
    const data = (await edited.json()).data
    expect(data.name).toBe('Nome do editor')
    expect(data.editorialLocked).toBe(true)

    const hidden = await deleteRecord(plain(admin.cookie, 'DELETE'), record('produtos', product.id))
    expect(hidden.status).toBe(200)
    const [row] = await db.select().from(products).where(eq(products.id, product.id))
    expect(row.status).toBe('removed')
    expect(row.editorialLocked).toBe(true)
  })

  it('coleção manual não pode usar o endereço de uma automática', async () => {
    const admin = await createAuthenticatedUser('MARKETING')
    const body = { title: 'Minha seleção', tone: 'Nossa equipe', description: 'Texto', status: 'draft', productIds: [] }
    expect((await createResource(json({ ...body, slug: 'viralizou' }, admin.cookie), resource('colecoes'))).status).toBe(409)
    expect((await createResource(json({ ...body, slug: 'mais-vendidos-casa' }, admin.cookie), resource('colecoes'))).status).toBe(409)
    expect((await createResource(json({ ...body, slug: `teste-contrato-${unique()}` }, admin.cookie), resource('colecoes'))).status).toBe(201)
  })

  it('configurações: valida, grava, lê e restaura o padrão', async () => {
    const admin = await createAuthenticatedUser('ADMIN')
    const bad = await putSetting(json({ similarLimit: 50 }, admin.cookie, 'PUT'), setting('slots'))
    expect(bad.status).toBe(422)

    const saved = await putSetting(json({ similarEnabled: true, similarLimit: 6 }, admin.cookie, 'PUT'), setting('slots'))
    expect(saved.status).toBe(200)
    const read = (await (await getSettingRoute(plain(admin.cookie), setting('slots'))).json()).data
    expect(read.value.similarLimit).toBe(6)
    expect(read.isDefault).toBe(false)

    const reset = await resetSetting(plain(admin.cookie, 'DELETE'), setting('slots'))
    expect(reset.status).toBe(200)
    expect((await (await getSettingRoute(plain(admin.cookie), setting('slots'))).json()).data.value.similarLimit).toBe(4)
  })

  it('só quem tem settings:write altera o tema, e a cor precisa de contraste', async () => {
    const marketing = await createAuthenticatedUser('MARKETING')
    expect((await putSetting(json({ primary: '#1d4ed8' }, marketing.cookie, 'PUT'), setting('theme'))).status).toBe(403)
    const admin = await createAuthenticatedUser('ADMIN')
    expect((await putSetting(json({ primary: '#ffff00' }, admin.cookie, 'PUT'), setting('theme'))).status).toBe(422)
  })

  it('usuários: ninguém tira o próprio acesso de administração', async () => {
    const admin = await createAuthenticatedUser('OWNER')
    const roles = await (await (await import('@/app/api/v1/admin/lookups/[kind]/route')).GET(plain(admin.cookie), { params: Promise.resolve({ kind: 'roles' }) })).json()
    const marketingId = roles.data.find((role: { label: string }) => role.label === 'Marketing').value
    const attempt = await patchRecord(json({ roleIds: [marketingId] }, admin.cookie, 'PATCH'), record('usuarios', admin.userId))
    expect(attempt.status).toBe(409)
  })

  it('segmento: calcula o alcance sobre os cliques medidos', async () => {
    const admin = await createAuthenticatedUser('ANALYST')
    const preview = await previewSegment(json({ match: 'all', rules: { windowDays: 30, conditions: [{ type: 'min_clicks', value: 1 }] } }, admin.cookie))
    expect(preview.status).toBe(200)
    expect(typeof (await preview.json()).data.reach).toBe('number')
  })

  it('engajamento: aceita só cupom e campanha existentes', async () => {
    resetRateLimits()
    const request = (body: unknown) => new Request('http://localhost/api/v1/engagement', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect((await engagement(request({ kind: 'coupon', id: 'nao-uuid' }))).status).toBe(422)
    expect((await engagement(request({ kind: 'coupon', id: crypto.randomUUID() }))).status).toBe(404)
    expect((await engagement(request({ kind: 'campaign', id: 'nao-existe' }))).status).toBe(404)
    expect((await engagement(request({ kind: 'outro', id: 'x' }))).status).toBe(422)
  })
})
