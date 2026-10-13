import { afterAll, describe, expect, it } from 'vitest'
import { eq, like, sql } from 'drizzle-orm'
import { DELETE as deleteExperiment, GET as listExperiments, POST as createExperiment } from '@/app/api/v1/admin/experiments/route'
import { POST as experimentAction } from '@/app/api/v1/admin/experiments/[id]/route'
import { POST as exposure } from '@/app/api/v1/experiments/exposure/route'
import { POST as outboundClick } from '@/app/api/v1/outbound-clicks/route'
import { db } from '@/lib/db/client'
import { abExperiments, affiliateClicks, analyticsEvents, offers, products, providers } from '@/lib/db/schema'
import { getRunningExperiment } from '@/lib/db/repositories/experiments'
import { experimentTag } from '@/lib/experiments/core'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { createAuthenticatedUser } from '../helpers/auth'

const keys: string[] = []
const productIds: string[] = []
const providerIds: string[] = []

afterAll(async () => {
  for (const key of keys) {
    await db.delete(analyticsEvents).where(sql`${analyticsEvents.metadata}->>'experiment' = ${key}`)
    await db.delete(affiliateClicks).where(like(affiliateClicks.subId, `%${key}%`))
  }
  await db.delete(abExperiments).where(like(abExperiments.key, 'teste-ab-%'))
  for (const id of productIds) await db.delete(products).where(eq(products.id, id))
  for (const id of providerIds) await db.delete(providers).where(eq(providers.id, id))
})

const json = (body: unknown, cookie?: string, method = 'POST') => new Request('http://localhost/x', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

/** Teste direto no banco com 0% na B: nenhum visitante real vê a variante B enquanto o teste de integração roda. */
async function draftExperiment(patch: Partial<typeof abExperiments.$inferInsert> = {}) {
  const key = `teste-ab-${crypto.randomUUID().slice(0, 6)}`
  keys.push(key)
  const [row] = await db.insert(abExperiments).values({ key, name: 'Teste de integração', variantB: { title: 'Outro título' }, splitB: 0, ...patch }).returning()
  return row
}

async function runningNow() {
  const [row] = await db.select({ id: abExperiments.id }).from(abExperiments).where(eq(abExperiments.status, 'running')).limit(1)
  return Boolean(row)
}

describe('testes A/B: criação e permissões', () => {
  it('exige sessão e permissão; valida nome, textos e divisão', async () => {
    expect((await listExperiments(new Request('http://localhost/x'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    expect((await listExperiments(new Request('http://localhost/x', { headers: { cookie: reader.cookie } }))).status).toBe(200)
    expect((await createExperiment(json({ name: 'x', variantB: { title: 'y' } }, reader.cookie))).status).toBe(403)

    const editor = await createAuthenticatedUser('MARKETING')
    const bad = await createExperiment(json({ name: '', variantB: {}, splitB: 99 }, editor.cookie))
    expect(bad.status).toBe(422)
    const details = (await bad.json()).error.details
    expect(details).toMatchObject({ name: expect.any(String), 'variantB.title': expect.any(String), splitB: expect.any(String) })
  })

  it('cria em rascunho e só rascunho pode ser apagado', async () => {
    const editor = await createAuthenticatedUser('MARKETING')
    const created = await createExperiment(json({ name: 'Teste ab criação', variantB: { title: 'Achados do dia' }, splitB: 50 }, editor.cookie))
    expect(created.status).toBe(201)
    const { id, key } = (await created.json()).data
    keys.push(key)
    const [row] = await db.select().from(abExperiments).where(eq(abExperiments.id, id))
    expect(row).toMatchObject({ status: 'draft', splitB: 50, variantB: { title: 'Achados do dia' } })

    const removed = await deleteExperiment(new Request(`http://localhost/x?id=${id}`, { method: 'DELETE', headers: { cookie: editor.cookie } }))
    expect(removed.status).toBe(200)
  })
})

describe('testes A/B: ciclo completo', () => {
  it('iniciar, expor, clicar, medir e encerrar', async () => {
    if (await runningNow()) return // não mexe em um teste real que esteja no ar
    resetRateLimits()
    const editor = await createAuthenticatedUser('MARKETING')
    const row = await draftExperiment()

    // Oferta de apoio para os cliques.
    const suffix = crypto.randomUUID().slice(0, 8)
    const [provider] = await db.insert(providers).values({ code: `prov-ab-${suffix}`, displayName: 'Provider AB' }).returning()
    const [product] = await db.insert(products).values({ slug: `produto-ab-${suffix}`, name: 'Produto AB', status: 'removed' }).returning()
    const [offer] = await db.insert(offers).values({ productId: product.id, providerId: provider.id, externalId: `ext-${suffix}`, externalUrl: 'https://provider.test/x', price: '10.00' }).returning()
    providerIds.push(provider.id); productIds.push(product.id)

    // Antes de iniciar, ninguém é medido.
    const early = await exposure(json({ key: row.key, variant: 'a', sessionId: 's-early' }))
    expect((await early.json()).data.recorded).toBe(false)

    const started = await experimentAction(json({ action: 'start' }, editor.cookie), ctx(row.id))
    expect(started.status).toBe(200)
    expect((await getRunningExperiment())?.key).toBe(row.key)

    // Um segundo teste não inicia enquanto este roda.
    const second = await draftExperiment()
    expect((await experimentAction(json({ action: 'start' }, editor.cookie), ctx(second.id))).status).toBe(409)

    const expose = (variant: string, session: string, key = row.key) => exposure(json({ key, variant, sessionId: session }))
    for (const session of ['a1', 'a2', 'a3']) expect((await (await expose('a', session)).json()).data.recorded).toBe(true)
    for (const session of ['b1', 'b2']) expect((await (await expose('b', session)).json()).data.recorded).toBe(true)
    expect((await (await expose('b', 'x', 'outro-teste')).json()).data.recorded).toBe(false)
    expect((await expose('c', 'x')).status).toBe(422)

    const click = (variant: 'a' | 'b', session: string) => outboundClick(json({ offerId: offer.id, slot: 'home_trending', sessionId: session, experiment: experimentTag(row.key, variant) }))
    expect((await click('a', 'a1')).status).toBe(201)
    expect((await click('a', 'a1')).status).toBe(201) // dois cliques da mesma visita contam uma conversão
    expect((await click('a', 'a2')).status).toBe(201)
    expect((await click('b', 'b1')).status).toBe(201)

    const listed = await listExperiments(new Request('http://localhost/x', { headers: { cookie: editor.cookie } }))
    const mine = ((await listed.json()).data.experiments as { id: string; results: { a: { exposed: number; converted: number }; b: { exposed: number; converted: number }; comparison: { verdict: string } } }[]).find((item) => item.id === row.id)!
    expect(mine.results.a).toEqual({ exposed: 3, converted: 2 })
    expect(mine.results.b).toEqual({ exposed: 2, converted: 1 })
    expect(mine.results.comparison.verdict).toBe('insufficient')

    const stopped = await experimentAction(json({ action: 'stop', winner: 'a' }, editor.cookie), ctx(row.id))
    expect(stopped.status).toBe(200)
    expect((await db.select().from(abExperiments).where(eq(abExperiments.id, row.id)))[0]).toMatchObject({ status: 'stopped', winner: 'a' })
    expect((await (await expose('a', 'late')).json()).data.recorded).toBe(false)
    expect((await experimentAction(json({ action: 'start' }, editor.cookie), ctx(row.id))).status).toBe(409)
  })

  it('ação inválida e identificador inexistente', async () => {
    const editor = await createAuthenticatedUser('MARKETING')
    const row = await draftExperiment()
    expect((await experimentAction(json({ action: 'explodir' }, editor.cookie), ctx(row.id))).status).toBe(422)
    expect((await experimentAction(json({ action: 'start' }, editor.cookie), ctx('nao-e-uuid'))).status).toBe(404)
    expect((await experimentAction(json({ action: 'start' }, editor.cookie), ctx(crypto.randomUUID()))).status).toBe(404)
    expect((await experimentAction(json({ action: 'stop' }, editor.cookie), ctx(row.id))).status).toBe(409)
  })
})
