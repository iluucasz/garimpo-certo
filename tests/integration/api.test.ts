import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { GET as listProducts, POST as createProduct } from '@/app/api/v1/products/route'
import { POST as publishEvent } from '@/app/api/v1/events/route'
import { POST as createJob } from '@/app/api/v1/jobs/route'
import { GET as getOpenApi } from '@/app/api/v1/openapi/route'
import { POST as syncProvider } from '@/app/api/v1/providers/[provider]/sync/route'
import { POST as conversionWebhook } from '@/app/api/v1/webhooks/conversions/route'
import { resetRateLimits } from '@/lib/server/mock-rate-limit'
import { recordAffiliateClick } from '@/lib/analytics/attribution'
import { eq, inArray, like } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { affiliateClicks, affiliateConversions, analyticsEvents, commissionTransactions, idempotencyKeys, jobQueueEntries, offers, products, providers } from '@/lib/db/schema'
import { createAuthenticatedUser } from '../helpers/auth'

const jsonRequest = (url: string, body: unknown, headers: Record<string, string> = {}) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

const createdProductIds: string[] = []
const createdClickIds: string[] = []
const uniqueSlug = () => { const slug = `produto-de-contrato-${crypto.randomUUID().slice(0, 8)}`; return slug }

afterAll(async () => {
  const conversions = createdClickIds.length ? await db.select({ id: affiliateConversions.id }).from(affiliateConversions).where(inArray(affiliateConversions.clickId, createdClickIds)) : []
  const conversionIds = conversions.map((row) => row.id)
  if (conversionIds.length) await db.delete(commissionTransactions).where(inArray(commissionTransactions.conversionId, conversionIds))
  if (conversionIds.length) await db.delete(affiliateConversions).where(inArray(affiliateConversions.id, conversionIds))
  if (createdClickIds.length) await db.delete(affiliateClicks).where(inArray(affiliateClicks.clickId, createdClickIds))
  if (createdProductIds.length) await db.delete(products).where(inArray(products.id, createdProductIds)) // cascades to offers
  await db.delete(jobQueueEntries).where(eq(jobQueueEntries.jobType, 'catalog.refresh'))
  await db.delete(jobQueueEntries).where(eq(jobQueueEntries.jobType, 'provider.import'))
  await db.delete(analyticsEvents).where(eq(analyticsEvents.sessionId, 'server'))
  await db.delete(idempotencyKeys).where(like(idempotencyKeys.key, '%integration%'))
})

describe('API v1', () => {
  beforeEach(() => resetRateLimits())

  it('lista catálogo no envelope padrão', async () => {
    const response = await listProducts(new Request('http://localhost/api/v1/products'))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.meta.mode).toBe('real')
    expect(body.meta.timestamp).toBeTruthy()
  })

  it('nega acesso sem sessão', async () => {
    const response = await createProduct(jsonRequest('http://localhost/api/v1/products', { slug: uniqueSlug(), name: 'Produto de contrato' }))
    expect(response.status).toBe(401)
  })

  it('nega mutação de catálogo para papel somente leitura', async () => {
    const { cookie } = await createAuthenticatedUser('READ_ONLY')
    const response = await createProduct(jsonRequest('http://localhost/api/v1/products', { slug: uniqueSlug(), name: 'Produto de contrato' }, { cookie }))
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('FORBIDDEN')
  })

  it('rejeita produto inválido com detalhes seguros', async () => {
    const { cookie } = await createAuthenticatedUser('OWNER')
    const response = await createProduct(jsonRequest('http://localhost/api/v1/products', { slug: '../invalido', name: 'x' }, { cookie }))
    const body = await response.json()
    expect(response.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details.issues.length).toBeGreaterThan(0)
  })

  it('cria um produto válido', async () => {
    const { cookie } = await createAuthenticatedUser('OWNER')
    const response = await createProduct(jsonRequest('http://localhost/api/v1/products', { slug: uniqueSlug(), name: 'Produto de contrato' }, { cookie }))
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.data.status).toBe('active')
    createdProductIds.push(body.data.id)
  })

  it('exige idempotência na sincronização', async () => {
    const { cookie } = await createAuthenticatedUser('CATALOG_MANAGER')
    const response = await syncProvider(jsonRequest('http://localhost/api/v1/providers/shopee/sync', {}, { cookie }), { params: Promise.resolve({ provider: 'shopee' }) })
    expect(response.status).toBe(428)
  })

  it('reutiliza sincronização com a mesma chave', async () => {
    const { cookie } = await createAuthenticatedUser('CATALOG_MANAGER')
    const headers = { cookie, 'idempotency-key': `sync:integration:${crypto.randomUUID()}` }
    const first = await syncProvider(jsonRequest('http://localhost/api/v1/providers/shopee/sync', { items: [] }, headers), { params: Promise.resolve({ provider: 'shopee' }) })
    const replay = await syncProvider(jsonRequest('http://localhost/api/v1/providers/shopee/sync', { items: [] }, headers), { params: Promise.resolve({ provider: 'shopee' }) })
    expect(first.status).toBe(202)
    expect(replay.status).toBe(200)
    expect((await replay.json()).data.idempotency.replayed).toBe(true)
  })

  it('valida assinatura de conversão', async () => {
    const response = await conversionWebhook(jsonRequest('http://localhost/api/v1/webhooks/conversions', { conversionId: 'c1', clickId: 'k1', amount: 100, provider: 'shopee' }, { 'idempotency-key': 'conversion:test' }))
    expect(response.status).toBe(401)
  })

  it('aceita uma conversão válida apenas uma vez', async () => {
    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.code, 'shopee'))
    const [product] = await db.insert(products).values({ slug: uniqueSlug(), name: 'Produto para conversão' }).returning()
    createdProductIds.push(product.id)
    const [offer] = await db.insert(offers).values({ productId: product.id, providerId: provider.id, externalId: `ext-${crypto.randomUUID()}`, externalUrl: 'https://provider.test/x', price: '10.00' }).returning()
    const click = await recordAffiliateClick({ offerId: offer.id, subId: 'test', sessionId: `sess-${crypto.randomUUID()}` })
    createdClickIds.push(click.clickId)
    const headers = { 'idempotency-key': `conversion:integration:${crypto.randomUUID()}`, 'x-mock-signature': 'garimpo-mock-signature' }
    const payload = { conversionId: `conversion-${crypto.randomUUID()}`, clickId: click.clickId, amount: 100, provider: 'shopee' }
    const first = await conversionWebhook(jsonRequest('http://localhost/api/v1/webhooks/conversions', payload, headers))
    const replay = await conversionWebhook(jsonRequest('http://localhost/api/v1/webhooks/conversions', payload, headers))
    expect(first.status).toBe(202)
    expect(replay.status).toBe(200)
    expect((await replay.json()).data.replayed).toBe(true)
  })

  it('rejeita tipo de evento desconhecido', async () => {
    const response = await publishEvent(jsonRequest('http://localhost/api/v1/events', { type: 'UnknownEvent', aggregateId: 'p1' }, { 'x-mock-client': 'unknown-event-test' }))
    expect(response.status).toBe(422)
  })

  it('limita rajadas de eventos por cliente', async () => {
    const responses = await Promise.all(Array.from({ length: 61 }, (_, index) => publishEvent(jsonRequest('http://localhost/api/v1/events', { type: 'FavoriteAdded', aggregateId: `p${index}` }, { 'x-mock-client': 'burst-test' }))))
    expect(responses.filter((response) => response.status === 202)).toHaveLength(60)
    expect(responses.at(-1)?.status).toBe(429)
    expect(responses.at(-1)?.headers.get('retry-after')).toBeTruthy()
  })

  it('agenda jobs com autorização e idempotência', async () => {
    const { cookie } = await createAuthenticatedUser('CATALOG_MANAGER')
    const headers = { cookie, 'idempotency-key': `job:integration:${crypto.randomUUID()}` }
    const first = await createJob(jsonRequest('http://localhost/api/v1/jobs', { topic: 'catalog.refresh', payload: { source: 'test' } }, headers))
    const replay = await createJob(jsonRequest('http://localhost/api/v1/jobs', { topic: 'catalog.refresh', payload: { source: 'test' } }, headers))
    expect(first.status).toBe(202)
    expect(replay.status).toBe(200)
    expect((await replay.json()).data.replayed).toBe(true)
  })

  it('publica contrato OpenAPI para todos os endpoints', async () => {
    const response = await getOpenApi()
    const body = await response.json()
    expect(body.data.openapi).toBe('3.1.0')
    expect(Object.keys(body.data.paths)).toHaveLength(17)
    expect(body.data.components.responses.RateLimited).toBeTruthy()
    expect(body.data.components.securitySchemes.mockRole).toBeTruthy()
  })
})
