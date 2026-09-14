import { afterAll, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { createSafeSubId, getAttribution, recordAffiliateClick, recordConversion } from '@/lib/analytics/attribution'
import { db } from '@/lib/db/client'
import { affiliateClicks, affiliateConversions, commissionTransactions, offers, products, providers } from '@/lib/db/schema'

const createdProductIds: string[] = []
const createdProviderIds: string[] = []
const createdClickIds: string[] = []

afterAll(async () => {
  const conversions = createdClickIds.length ? await db.select({ id: affiliateConversions.id }).from(affiliateConversions).where(inArray(affiliateConversions.clickId, createdClickIds)) : []
  const conversionIds = conversions.map((row) => row.id)
  if (conversionIds.length) await db.delete(commissionTransactions).where(inArray(commissionTransactions.conversionId, conversionIds))
  if (conversionIds.length) await db.delete(affiliateConversions).where(inArray(affiliateConversions.id, conversionIds))
  if (createdClickIds.length) await db.delete(affiliateClicks).where(inArray(affiliateClicks.clickId, createdClickIds))
  if (createdProductIds.length) await db.delete(products).where(inArray(products.id, createdProductIds)) // cascades to offers
  if (createdProviderIds.length) await db.delete(providers).where(inArray(providers.id, createdProviderIds))
})

async function createFixtureOffer() {
  const [provider] = await db.insert(providers).values({ code: `prov-${crypto.randomUUID().slice(0, 6)}`, displayName: 'Provider Teste' }).returning()
  const [product] = await db.insert(products).values({ slug: `produto-attr-${crypto.randomUUID().slice(0, 6)}`, name: 'Produto Atribuição' }).returning()
  const [offer] = await db.insert(offers).values({ productId: product.id, providerId: provider.id, externalId: 'ext-attr', externalUrl: 'https://provider.test/attr', price: '99.90' }).returning()
  createdProviderIds.push(provider.id); createdProductIds.push(product.id)
  return { offer, provider }
}

describe('atribuição', () => {
  it('registra clique e conversão e reflete nas métricas', async () => {
    const { offer } = await createFixtureOffer()
    const subId = createSafeSubId(['organic', 'home', 'control'])
    const click = await recordAffiliateClick({ offerId: offer.id, subId, sessionId: `sess-${crypto.randomUUID()}` })
    createdClickIds.push(click.clickId)
    await recordConversion({
      providerConversionId: `conv-${crypto.randomUUID()}`, clickId: click.clickId, providerId: offer.providerId,
      orderReferenceHash: 'sha256_test', amount: 100, commission: 5, status: 'approved',
    })
    const report = await getAttribution()
    expect(report.metrics.clicks).toBeGreaterThanOrEqual(1)
    expect(report.metrics.approvedCommission).toBeGreaterThanOrEqual(5)
    expect(report.metrics.estimatedCommission).toBeGreaterThanOrEqual(report.metrics.approvedCommission)
  })
})
