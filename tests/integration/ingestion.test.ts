import { afterAll, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { brands, products } from '@/lib/db/schema'
import { matchProviderProduct, normalizeProviderProduct } from '@/lib/server/ingestion'

const createdProductIds: string[] = []
const createdBrandIds: string[] = []

afterAll(async () => {
  if (createdProductIds.length) await db.delete(products).where(inArray(products.id, createdProductIds))
  if (createdBrandIds.length) await db.delete(brands).where(inArray(brands.id, createdBrandIds))
})

async function createFixtureProduct() {
  const [brand] = await db.insert(brands).values({ name: `Marca Teste ${crypto.randomUUID().slice(0, 6)}`, slug: `marca-teste-${crypto.randomUUID().slice(0, 6)}` }).returning()
  const [product] = await db.insert(products).values({ slug: `produto-teste-${crypto.randomUUID().slice(0, 6)}`, name: 'Headphone Quiet Pro', brandId: brand.id }).returning()
  createdBrandIds.push(brand.id); createdProductIds.push(product.id)
  return { product, brand }
}

describe('ingestão', () => {
  it('encontra o produto canônico com alta confiança', async () => {
    const { product, brand } = await createFixtureProduct()
    const raw = { externalId: ' ext-1 ', title: 'Headphone Quiet Pro', brand: brand.name, category: 'audio', price: 649, url: 'https://provider.test/item' }
    const [candidate] = await matchProviderProduct(raw)
    expect(candidate.productId).toBe(product.id)
    expect(candidate.confidence).toBeGreaterThan(.75)
  })

  it('normaliza identidade, preço e re-hospeda imagem quando fornecida', async () => {
    const raw = { externalId: ' ext-2 ', title: 'Produto sem correspondência', price: 199, url: 'https://provider.test/item-2' }
    const normalized = await normalizeProviderProduct(raw, 'test-provider')
    expect(normalized.externalId).toBe('ext-2')
    expect(normalized.price).toBe(199)
    expect(normalized.imageUrl).toBeNull()
  })
})
