import { db } from '@/lib/db/client'
import { brands, products } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rehostProviderImage } from '@/lib/storage/blob'

export type RawProviderProduct = { externalId: string; title: string; brand?: string; category?: string; price: number; url: string; imageUrl?: string }
export type MatchCandidate = { productId: string; confidence: number; reasons: string[] }

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (value: string) => new Set(normalize(value).split(' ').filter(Boolean))

export async function matchProviderProduct(raw: RawProviderProduct): Promise<MatchCandidate[]> {
  const source = tokens(`${raw.title} ${raw.brand ?? ''}`)
  const rows = await db.select({ id: products.id, name: products.name, brandName: brands.name }).from(products).leftJoin(brands, eq(products.brandId, brands.id))
  return rows.map((product) => {
    const target = tokens(`${product.name} ${product.brandName ?? ''}`)
    const common = [...source].filter((token) => target.has(token)).length
    const union = new Set([...source, ...target]).size
    const similarity = union ? common / union : 0
    const brandMatch = raw.brand && product.brandName && normalize(raw.brand) === normalize(product.brandName) ? .25 : 0
    return { productId: product.id, confidence: Math.min(.99, similarity + brandMatch), reasons: [brandMatch ? 'marca' : '', similarity > .35 ? 'título' : ''].filter(Boolean) }
  }).filter((candidate) => candidate.confidence >= .25).sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

export async function normalizeProviderProduct(raw: RawProviderProduct, providerCode: string) {
  const [candidates, imageUrl] = await Promise.all([
    matchProviderProduct(raw),
    raw.imageUrl ? rehostProviderImage(raw.imageUrl, providerCode) : Promise.resolve(null),
  ])
  return {
    externalId: raw.externalId.trim(), title: raw.title.trim(), brand: raw.brand?.trim() ?? 'Não identificada',
    category: raw.category?.trim() ?? 'Outros', price: Math.max(0, raw.price), url: raw.url,
    imageUrl, normalizedAt: new Date().toISOString(), candidates,
  }
}
