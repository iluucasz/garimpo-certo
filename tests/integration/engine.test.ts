import { afterAll, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { GET as engineState } from '@/app/api/v1/admin/engine/route'
import { POST as decideRoute } from '@/app/api/v1/admin/engine/proposals/[id]/route'
import { db } from '@/lib/db/client'
import { engineProposals, offers, products, providers } from '@/lib/db/schema'
import { activeSeasonalTerms, decideProposal, expireStale, loadEngineSettings, persistDrafts } from '@/lib/engine/store'
import type { ProposalDraft } from '@/lib/engine/rules'
import { createAuthenticatedUser } from '../helpers/auth'

const tag = `teste-${crypto.randomUUID().slice(0, 8)}`
const productIds: string[] = []
const providerIds: string[] = []

afterAll(async () => {
  await db.delete(engineProposals).where(like(engineProposals.subjectId, `${tag}%`))
  if (productIds.length) for (const id of productIds) await db.delete(products).where(eq(products.id, id))
  for (const id of providerIds) await db.delete(providers).where(eq(providers.id, id))
})

const termDraft = (suffix: string, patch: Partial<ProposalDraft> = {}): ProposalDraft => ({
  kind: 'import_term', subjectType: 'term', subjectId: `${tag}-${suffix}`, title: `Importar ${suffix}`, reason: 'Teste.',
  evidence: { daysUntil: 10 }, payload: { category: 'casa', keyword: `${tag} ${suffix}`, until: '2999-12-31' },
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(), ...patch,
})

async function fixtureProduct(patch: Partial<typeof products.$inferInsert> = {}) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const [provider] = await db.insert(providers).values({ code: `prov-eng-${suffix}`, displayName: 'Provider Engine' }).returning()
  const [product] = await db.insert(products).values({ slug: `produto-eng-${suffix}`, name: 'Produto Engine', status: 'active', ...patch }).returning()
  await db.insert(offers).values({ productId: product.id, providerId: provider.id, externalId: `ext-${suffix}`, externalUrl: 'https://provider.test/x', price: '50.00' })
  productIds.push(product.id); providerIds.push(provider.id)
  return product
}

const archiveDraft = (productId: string): ProposalDraft => ({
  kind: 'archive_product', subjectType: 'product', subjectId: `${tag}-${productId}`, title: 'Tirar produto', reason: 'Sem cliques.',
  evidence: { views: 10 }, payload: { productId }, expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
})

describe('persistência das propostas', () => {
  it('cria pendente, ou sombra no modo sombra, e não duplica', async () => {
    const draft = termDraft('a')
    expect(await persistDrafts([draft], 'approval')).toEqual({ created: 1, refreshed: 0, skipped: 0 })
    expect(await persistDrafts([{ ...draft, reason: 'Novo motivo.' }], 'approval')).toEqual({ created: 0, refreshed: 1, skipped: 0 })
    const rows = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, draft.subjectId))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'pending', reason: 'Novo motivo.' })

    const shadow = termDraft('b')
    await persistDrafts([shadow], 'shadow')
    const [shadowRow] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, shadow.subjectId))
    expect(shadowRow.status).toBe('shadow')
  })

  it('proposta do modo sombra não pode ser aprovada', async () => {
    const draft = termDraft('sombra')
    await persistDrafts([draft], 'shadow')
    const [row] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, draft.subjectId))
    const result = await decideProposal(row.id, 'approve', null)
    expect(result).toMatchObject({ status: 409 })
  })

  it('recusa vale por 30 dias; expirada some da fila', async () => {
    const draft = termDraft('recusa')
    await persistDrafts([draft], 'approval')
    const [row] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, draft.subjectId))
    const rejected = await decideProposal(row.id, 'reject', null, 'não faz sentido')
    expect('row' in rejected && rejected.row.status).toBe('rejected')
    expect(await persistDrafts([draft], 'approval')).toEqual({ created: 0, refreshed: 0, skipped: 1 })

    const old = termDraft('velha', { expiresAt: new Date(Date.now() - 1000).toISOString() })
    await persistDrafts([old], 'approval')
    expect(await expireStale()).toBeGreaterThanOrEqual(1)
    const [expired] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, old.subjectId))
    expect(expired.status).toBe('expired')
  })
})

describe('aplicação das propostas', () => {
  it('aprovar a saída de um produto arquiva, trava e esconde a oferta', async () => {
    const product = await fixtureProduct()
    const draft = archiveDraft(product.id)
    await persistDrafts([draft], 'approval')
    const [row] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, draft.subjectId))

    const result = await decideProposal(row.id, 'approve', null)
    expect('row' in result && result.row.status).toBe('applied')
    expect('invalidate' in result && result.invalidate).toContain('catalog')

    const [after] = await db.select({ status: products.status, locked: products.editorialLocked }).from(products).where(eq(products.id, product.id))
    expect(after).toEqual({ status: 'removed', locked: true })
    const [offer] = await db.select({ status: offers.status }).from(offers).where(eq(offers.productId, product.id))
    expect(offer.status).toBe('removed')
  })

  it('falha com mensagem clara se o produto foi editado pela equipe no meio do caminho', async () => {
    const product = await fixtureProduct({ editorialLocked: true })
    const draft = archiveDraft(product.id)
    await persistDrafts([draft], 'approval')
    const [row] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, draft.subjectId))
    const result = await decideProposal(row.id, 'approve', null)
    expect('row' in result && result.row.status).toBe('failed')
    expect('row' in result && JSON.stringify(result.row.result)).toContain('editado pela equipe')
    const [after] = await db.select({ status: products.status }).from(products).where(eq(products.id, product.id))
    expect(after.status).toBe('active')
  })

  it('termo aprovado vale até a data e alimenta o importador', async () => {
    const draft = termDraft('termo')
    await persistDrafts([draft], 'approval')
    const [row] = await db.select().from(engineProposals).where(eq(engineProposals.subjectId, draft.subjectId))
    await decideProposal(row.id, 'approve', null)
    const terms = await activeSeasonalTerms()
    expect(terms).toContainEqual({ category: 'casa', keyword: `${tag} termo` })

    // Depois da validade, o termo deixa de ser usado.
    expect(await activeSeasonalTerms(new Date('3000-02-01T00:00:00Z'))).not.toContainEqual({ category: 'casa', keyword: `${tag} termo` })
  })
})

describe('configuração e API', () => {
  it('lê a configuração com padrões seguros (modo sombra)', async () => {
    const settings = await loadEngineSettings()
    expect(['off', 'shadow', 'approval', 'auto']).toContain(settings.mode)
    expect(settings.minSiteViews).toBeGreaterThan(0)
    expect(settings.maxShare).toBeGreaterThan(0)
    expect(settings.maxShare).toBeLessThanOrEqual(0.3)
  })

  it('o estado exige sessão e a decisão exige permissão de escrita', async () => {
    expect((await engineState(new Request('http://localhost/x'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    const state = await engineState(new Request('http://localhost/x', { headers: { cookie: reader.cookie } }))
    expect(state.status).toBe(200)
    expect(Object.keys((await state.json()).data)).toEqual(expect.arrayContaining(['settings', 'pending', 'shadow', 'history']))

    const post = (id: string, body: unknown, cookie: string) => decideRoute(
      new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }),
      { params: Promise.resolve({ id }) },
    )
    expect((await post(crypto.randomUUID(), { decision: 'approve' }, reader.cookie)).status).toBe(403)
    const catalog = await createAuthenticatedUser('CATALOG_MANAGER')
    expect((await post(crypto.randomUUID(), { decision: 'talvez' }, catalog.cookie)).status).toBe(422)
    expect((await post(crypto.randomUUID(), { decision: 'approve' }, catalog.cookie)).status).toBe(404)
    expect((await post('nao-e-uuid', { decision: 'approve' }, catalog.cookie)).status).toBe(404)
  })
})
