import { afterAll, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { getCommissionReport } from '@/lib/db/repositories/commissions'
import { upsertConversions } from '@/lib/db/repositories/conversions-import'
import { getCouponClickReport, getCouponClickStats } from '@/lib/db/repositories/coupon-clicks'
import { getProductMetrics } from '@/lib/db/repositories/product-metrics'
import { affiliateConversionItems, affiliateConversions, analyticsEvents, commissionTransactions, coupons, offers, products, providers } from '@/lib/db/schema'
import type { ConversionRecord } from '@/lib/providers/shopee/conversions'

const productIds: string[] = []
const providerIds: string[] = []
const couponIds: string[] = []
const sessionIds: string[] = []

afterAll(async () => {
  if (providerIds.length) {
    const rows = await db.select({ id: affiliateConversions.id }).from(affiliateConversions).where(inArray(affiliateConversions.providerId, providerIds))
    const ids = rows.map((row) => row.id)
    if (ids.length) await db.delete(commissionTransactions).where(inArray(commissionTransactions.conversionId, ids))
    if (ids.length) await db.delete(affiliateConversionItems).where(inArray(affiliateConversionItems.conversionId, ids))
    if (ids.length) await db.delete(affiliateConversions).where(inArray(affiliateConversions.id, ids))
  }
  if (sessionIds.length) await db.delete(analyticsEvents).where(inArray(analyticsEvents.sessionId, sessionIds))
  if (couponIds.length) await db.delete(coupons).where(inArray(coupons.id, couponIds))
  if (productIds.length) await db.delete(products).where(inArray(products.id, productIds))
  if (providerIds.length) await db.delete(providers).where(inArray(providers.id, providerIds))
})

async function fixture() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const [provider] = await db.insert(providers).values({ code: `prov-com-${suffix}`, displayName: 'Provider Comissão' }).returning()
  const [product] = await db.insert(products).values({ slug: `produto-com-${suffix}`, name: 'Produto Comissão', status: 'active' }).returning()
  const externalId = `item-${suffix}`
  const [offer] = await db.insert(offers).values({ productId: product.id, providerId: provider.id, externalId, externalUrl: 'https://provider.test/x', price: '100.00' }).returning()
  providerIds.push(provider.id); productIds.push(product.id)
  return { provider, product, offer, externalId }
}

const record = (externalId: string, patch: Partial<ConversionRecord> = {}): ConversionRecord => ({
  providerConversionId: `conv-${crypto.randomUUID()}`, status: 'pending', amount: 100, commission: 8, subIds: 'site-tecnologia', buyerType: 'new',
  clickedAt: new Date(Date.now() - 3_600_000).toISOString(), convertedAt: new Date().toISOString(), orderReferenceHash: `sha256_${crypto.randomUUID().slice(0, 8)}`,
  items: [{ externalItemId: externalId, itemName: 'Produto Comissão', quantity: 1, amount: 100, refundAmount: 0, commission: 8, status: 'Pending' }],
  ...patch,
})

describe('comissões reais importadas da Shopee', () => {
  it('grava a conversão com os itens ligados ao produto e é idempotente', async () => {
    const { provider, externalId, offer } = await fixture()
    const item = record(externalId)

    const first = await upsertConversions([item], provider.id)
    expect(first).toMatchObject({ created: 1, updated: 0, unchanged: 0, items: 1, itemsWithoutOffer: 0 })

    const again = await upsertConversions([item], provider.id)
    expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 1 })

    const [row] = await db.select().from(affiliateConversions).where(and(eq(affiliateConversions.providerId, provider.id), eq(affiliateConversions.providerConversionId, item.providerConversionId)))
    expect(row).toMatchObject({ status: 'pending', subIds: 'site-tecnologia', buyerType: 'new', clickId: null })
    expect(Number(row.commission)).toBe(8)

    const items = await db.select().from(affiliateConversionItems).where(eq(affiliateConversionItems.conversionId, row.id))
    expect(items).toHaveLength(1)
    expect(items[0].offerId).toBe(offer.id)

    const [tx] = await db.select().from(commissionTransactions).where(eq(commissionTransactions.conversionId, row.id))
    expect(Number(tx.amount)).toBe(8)
  })

  it('acompanha a mudança de status e valor sem duplicar, e não desfaz o que foi pago', async () => {
    const { provider, externalId } = await fixture()
    const item = record(externalId)
    await upsertConversions([item], provider.id)

    const approved = await upsertConversions([{ ...item, status: 'approved', commission: 9.5 }], provider.id)
    expect(approved).toMatchObject({ created: 0, updated: 1 })

    const [row] = await db.select().from(affiliateConversions).where(and(eq(affiliateConversions.providerId, provider.id), eq(affiliateConversions.providerConversionId, item.providerConversionId)))
    expect(row.status).toBe('approved')
    expect(Number(row.commission)).toBe(9.5)
    const items = await db.select().from(affiliateConversionItems).where(eq(affiliateConversionItems.conversionId, row.id))
    expect(items).toHaveLength(1)

    await db.update(affiliateConversions).set({ status: 'paid' }).where(eq(affiliateConversions.id, row.id))
    await upsertConversions([{ ...item, status: 'cancelled', commission: 0 }], provider.id)
    const [after] = await db.select().from(affiliateConversions).where(eq(affiliateConversions.id, row.id))
    expect(after.status).toBe('paid')
  })

  it('guarda item de produto fora do catálogo sem ligar a nenhuma oferta', async () => {
    const { provider } = await fixture()
    const result = await upsertConversions([record('item-desconhecido-999')], provider.id)
    expect(result).toMatchObject({ created: 1, items: 1, itemsWithoutOffer: 1 })
  })

  it('aparece no relatório por origem e por produto, e nas métricas do produto', async () => {
    const { provider, product, externalId } = await fixture()
    await upsertConversions([
      record(externalId, { status: 'approved', commission: 20, amount: 200, subIds: 'telegram-ofertasdodia', items: [{ externalItemId: externalId, itemName: 'Produto Comissão', quantity: 2, amount: 200, refundAmount: 0, commission: 20, status: 'Completed' }] }),
      record(externalId, { status: 'cancelled', commission: 50, subIds: 'telegram-ofertasdodia' }),
    ], provider.id)

    const report = await getCommissionReport(30)
    expect(report.totals.lost.count).toBeGreaterThanOrEqual(1)
    expect(report.totals.approved.commission).toBeGreaterThanOrEqual(20)
    // cancelada não conta como origem nem como produto
    const origin = report.byOrigin.find((row) => row.channel === 'telegram' && row.detail === 'ofertasdodia')
    expect(origin).toBeTruthy()
    expect(origin!.commission).toBeGreaterThanOrEqual(20)
    const top = report.byProduct.find((row) => row.productId === product.id)
    expect(top).toMatchObject({ conversions: 1, quantity: 2 })
    expect(top!.commission).toBe(20)

    const metrics = await getProductMetrics()
    expect(metrics[product.id]?.conversions).toBe(1)
  })
})

describe('cliques por cupom', () => {
  it('conta só os cliques do cupom, por janela, e sessões distintas', async () => {
    const [coupon] = await db.insert(coupons).values({ title: 'Cupom Teste Cliques', url: 'https://s.shopee.com.br/teste' }).returning()
    couponIds.push(coupon.id)
    const [other] = await db.insert(coupons).values({ title: 'Cupom Sem Clique', url: 'https://s.shopee.com.br/teste2' }).returning()
    couponIds.push(other.id)

    const sessionA = `sess-${crypto.randomUUID()}`
    const sessionB = `sess-${crypto.randomUUID()}`
    sessionIds.push(sessionA, sessionB)
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
    await db.insert(analyticsEvents).values([
      { eventName: 'coupon_click', anonymousId: sessionA, sessionId: sessionA, metadata: { couponId: coupon.id }, timestamp: day(0) },
      { eventName: 'coupon_click', anonymousId: sessionA, sessionId: sessionA, metadata: { couponId: coupon.id }, timestamp: day(2) },
      { eventName: 'coupon_click', anonymousId: sessionB, sessionId: sessionB, metadata: { couponId: coupon.id }, timestamp: day(20) },
      { eventName: 'campaign_click', anonymousId: sessionB, sessionId: sessionB, metadata: {}, campaignId: 'banner', timestamp: day(0) },
    ])

    const stats = (await getCouponClickStats()).get(coupon.id)
    expect(stats).toMatchObject({ clicks7d: 2, clicks30d: 3, sessions30d: 2 })
    expect((await getCouponClickStats()).get(other.id)).toBeUndefined()

    const report = await getCouponClickReport()
    expect(report.byDay).toHaveLength(14)
    expect(report.totals.last30d).toBeGreaterThanOrEqual(3)
    expect(report.top.find((row) => row.couponId === coupon.id)?.clicks30d).toBe(3)
    expect(report.top.find((row) => row.couponId === other.id)).toBeUndefined()
    expect(report.neverClicked).toBeGreaterThanOrEqual(1)
  })
})
