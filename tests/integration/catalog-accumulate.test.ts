import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { brands, categories, offers, priceHistory, productCategories, productImages, productTags, products, providers } from '@/lib/db/schema'
import { archiveProductsByExternalIds, getOrCreateProvider, importCatalogItem, listKnownProducts } from '@/lib/db/repositories/catalog-import'
import type { CatalogItem } from '@/lib/providers/shopee/mapping'

const run = crypto.randomUUID().slice(0, 8)
const categorySlug = `teste-acumulo-${run}`
const externalId = `9${Date.now()}`
let providerId = ''

const item = (patch: Partial<CatalogItem> = {}): CatalogItem => ({
  externalId, slug: `produto-de-teste-${run}`, name: `Produto de teste ${run}`, brandName: `Loja de teste ${run}`, description: 'Teste.',
  categorySlug, imageUrl: 'https://cf.shopee.com.br/teste.jpg', rating: 4.8, editorialScore: 80, tags: [],
  price: 49.9, priceMax: null, originalPrice: null, discountPercentage: 0, commissionRate: 0.05, estimatedCommission: 2.5, soldCount: 120,
  sellerName: `Loja de teste ${run}`, externalUrl: 'https://shopee.com.br/teste', affiliateUrl: 'https://s.shopee.com.br/teste', ...patch,
})

describe('importação que acumula', () => {
  beforeAll(async () => {
    // Nunca gera link de afiliado de verdade num teste.
    process.env.SHOPEE_TAGGED_LINKS = '0'
    providerId = await getOrCreateProvider(`teste-acumulo-${run}`, 'Teste de acúmulo')
  })

  afterAll(async () => {
    const offerRows = await db.select({ id: offers.id, productId: offers.productId }).from(offers).where(eq(offers.providerId, providerId))
    const productIds = offerRows.map((row) => row.productId)
    if (offerRows.length) await db.delete(priceHistory).where(inArray(priceHistory.offerId, offerRows.map((row) => row.id)))
    await db.delete(offers).where(eq(offers.providerId, providerId))
    if (productIds.length) {
      await db.delete(productImages).where(inArray(productImages.productId, productIds))
      await db.delete(productTags).where(inArray(productTags.productId, productIds))
      await db.delete(productCategories).where(inArray(productCategories.productId, productIds))
      await db.delete(products).where(inArray(products.id, productIds))
    }
    await db.delete(categories).where(eq(categories.slug, categorySlug))
    await db.delete(brands).where(eq(brands.name, `Loja de teste ${run}`))
    await db.delete(providers).where(eq(providers.id, providerId))
  })

  it('reatualização sem mudança só carimba a sincronização; mudança de preço entra no histórico', async () => {
    const first = await importCatalogItem(item(), providerId, 'Teste de acúmulo')
    expect(first).toEqual({ isNew: true, priceChanged: true })
    const [created] = await db.select().from(offers).where(eq(offers.externalId, externalId))
    const before = await db.select().from(priceHistory).where(eq(priceHistory.offerId, created.id))
    expect(before).toHaveLength(1)

    await new Promise((resolve) => setTimeout(resolve, 20))
    const same = await importCatalogItem(item(), providerId, 'Teste de acúmulo')
    expect(same).toEqual({ isNew: false, priceChanged: false })
    const [after] = await db.select().from(offers).where(eq(offers.externalId, externalId))
    expect(new Date(after.lastSyncedAt).getTime()).toBeGreaterThan(new Date(created.lastSyncedAt).getTime())
    expect(await db.select().from(priceHistory).where(eq(priceHistory.offerId, created.id))).toHaveLength(1)

    const cheaper = await importCatalogItem(item({ price: 39.9 }), providerId, 'Teste de acúmulo')
    expect(cheaper).toEqual({ isNew: false, priceChanged: true })
    const [updated] = await db.select().from(offers).where(eq(offers.externalId, externalId))
    expect(Number(updated.price)).toBe(39.9)
    expect(await db.select().from(priceHistory).where(eq(priceHistory.offerId, created.id))).toHaveLength(2)
  })

  it('lista o que o parceiro já tem e arquiva por id externo sem apagar', async () => {
    const known = await listKnownProducts(providerId)
    const found = known.find((entry) => entry.externalId === externalId)
    expect(found).toMatchObject({ status: 'active', categorySlug, sellerName: `Loja de teste ${run}` })

    const archived = await archiveProductsByExternalIds([externalId], providerId)
    expect(archived).toEqual([`produto-de-teste-${run}`])
    const after = (await listKnownProducts(providerId)).find((entry) => entry.externalId === externalId)
    expect(after?.status).toBe('removed')
    // Arquivar de novo não encontra nada ativo.
    expect(await archiveProductsByExternalIds([externalId], providerId)).toEqual([])
  })
})
