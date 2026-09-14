import { eq } from 'drizzle-orm'
import { db } from '../client'
import { brands, categories, offers, priceHistory, productAttributeValues, productAttributes, productCategories, productImages, productTags, products, providers, tags } from '../schema'
import type { Category, Offer, Product, Provider } from '@/lib/types'

const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const availabilityToStock: Record<string, Offer['stock']> = {
  in_stock: 'disponível', out_of_stock: 'indisponível', unknown: 'disponível',
}

const relativeUpdatedAt = (isoDate: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000))
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.round(hours / 24)} d`
}

export type StoreCatalog = { products: Product[]; offers: Offer[]; providers: Provider[]; categories: Category[] }

export async function getStoreCatalog(): Promise<StoreCatalog> {
  const [productRows, offerRows, providerRows, categoryRows, brandRows, productCategoryRows, imageRows, tagRows, priceHistoryRows, attributeValueRows] = await Promise.all([
    db.select().from(products),
    db.select().from(offers),
    db.select().from(providers),
    db.select().from(categories),
    db.select().from(brands),
    db.select().from(productCategories),
    db.select().from(productImages),
    db.select({ productId: productTags.productId, label: tags.label }).from(productTags).innerJoin(tags, eq(productTags.tagId, tags.id)),
    db.select().from(priceHistory),
    db.select({ productId: productAttributeValues.productId, label: productAttributes.label, valueText: productAttributeValues.valueText })
      .from(productAttributeValues).innerJoin(productAttributes, eq(productAttributeValues.attributeId, productAttributes.id)),
  ])

  const brandById = new Map(brandRows.map((row) => [row.id, row]))
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]))
  const categoryByProduct = new Map(productCategoryRows.filter((row) => row.isPrimary).map((row) => [row.productId, categoryById.get(row.categoryId)]))
  const imagesByProduct = new Map<string, string[]>()
  for (const image of [...imageRows].sort((a, b) => a.position - b.position)) imagesByProduct.set(image.productId, [...(imagesByProduct.get(image.productId) ?? []), image.sourceUrl])
  const tagsByProduct = new Map<string, string[]>()
  for (const tag of tagRows) tagsByProduct.set(tag.productId, [...(tagsByProduct.get(tag.productId) ?? []), tag.label])
  const priceHistoryByOffer = new Map<string, { month: string; price: number }[]>()
  for (const point of [...priceHistoryRows].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))) {
    const month = monthLabels[new Date(point.capturedAt).getMonth()]
    priceHistoryByOffer.set(point.offerId, [...(priceHistoryByOffer.get(point.offerId) ?? []), { month, price: Number(point.price) }])
  }
  const priceHistoryByProduct = new Map<string, { month: string; price: number }[]>()
  for (const offer of offerRows) if (priceHistoryByOffer.has(offer.id)) priceHistoryByProduct.set(offer.productId, priceHistoryByOffer.get(offer.id)!)
  const specsByProduct = new Map<string, Record<string, string>>()
  for (const row of attributeValueRows) { if (row.valueText === null) continue; const current = specsByProduct.get(row.productId) ?? {}; current[row.label] = row.valueText; specsByProduct.set(row.productId, current) }

  const storeProducts: Product[] = productRows.map((row) => {
    const brand = row.brandId ? brandById.get(row.brandId) : undefined
    const category = categoryByProduct.get(row.id)
    const images = imagesByProduct.get(row.id) ?? []
    return {
      id: row.id, slug: row.slug, name: row.name, brand: brand?.name ?? 'Genérico', category: category?.slug ?? '',
      description: row.description ?? '', longDescription: row.description ?? '',
      image: images[0] ?? '/placeholder.jpg', images, rating: Number(row.rating), reviews: row.reviewsCount,
      score: Number(row.editorialScore), growth: Number(row.growthPercentage), tags: tagsByProduct.get(row.id) ?? [],
      specs: specsByProduct.get(row.id) ?? {}, priceHistory: priceHistoryByProduct.get(row.id) ?? [],
    }
  })

  const storeOffers: Offer[] = offerRows.map((row) => ({
    id: row.id, productId: row.productId, providerId: row.providerId, price: Number(row.price),
    previousPrice: row.originalPrice ? Number(row.originalPrice) : undefined, shipping: 0, installment: '',
    stock: availabilityToStock[row.availability] ?? 'disponível', url: row.affiliateUrl ?? row.externalUrl, updatedAt: relativeUpdatedAt(row.lastSyncedAt),
  }))

  const storeProviders: Provider[] = providerRows.map((row) => ({
    id: row.id, name: row.displayName, slug: row.code, rating: 4.5, verified: row.status === 'active', color: '#0d2440',
  }))

  const storeCategories: Category[] = categoryRows.map((row) => ({
    id: row.id, name: row.name, slug: row.slug, icon: 'Sparkles', description: '',
  }))

  return { products: storeProducts, offers: storeOffers, providers: storeProviders, categories: storeCategories }
}
