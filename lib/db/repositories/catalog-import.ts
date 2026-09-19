import { and, eq, isNull, desc, sql } from 'drizzle-orm'
import { db } from '../client'
import { brands, categories, offers, priceHistory, productCategories, productImages, productTags, products, providers, tags } from '../schema'
import { slugify, type CatalogItem } from '@/lib/providers/shopee/mapping'

export type ImportSummary = { created: number; updated: number; priceChanges: number }

async function getOrCreateBrand(name: string) {
  const slug = slugify(name) || 'loja'
  const [existing] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug))
  if (existing) return existing.id
  const [created] = await db.insert(brands).values({ name, slug }).onConflictDoNothing().returning({ id: brands.id })
  if (created) return created.id
  const [raced] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug))
  return raced.id
}

async function getOrCreateCategory(slug: string, name: string) {
  const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug))
  if (existing) return existing.id
  const [created] = await db.insert(categories).values({ name, slug, path: `/${slug}` }).returning({ id: categories.id })
  return created.id
}

async function getOrCreateTag(label: string) {
  const code = slugify(label)
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.code, code))
  if (existing) return existing.id
  const [created] = await db.insert(tags).values({ code, label }).onConflictDoNothing().returning({ id: tags.id })
  if (created) return created.id
  const [raced] = await db.select({ id: tags.id }).from(tags).where(eq(tags.code, code))
  return raced.id
}

export async function getOrCreateProvider(code: string, displayName: string) {
  const [existing] = await db.select({ id: providers.id }).from(providers).where(eq(providers.code, code))
  if (existing) return existing.id
  const [created] = await db.insert(providers).values({ code, displayName }).returning({ id: providers.id })
  return created.id
}

/** Grava (ou atualiza) um produto real e a oferta do parceiro, mantendo o histórico de preço. */
export async function importCatalogItem(item: CatalogItem, providerId: string, categoryName: string) {
  const brandId = await getOrCreateBrand(item.brandName)
  const categoryId = await getOrCreateCategory(item.categorySlug, categoryName)

  const [existingOffer] = await db.select({ id: offers.id, productId: offers.productId, price: offers.price })
    .from(offers).where(and(eq(offers.providerId, providerId), eq(offers.externalId, item.externalId)))
  const [existingBySlug] = existingOffer ? [] : await db.select({ id: products.id }).from(products).where(eq(products.slug, item.slug))

  const productValues = {
    slug: item.slug, name: item.name, brandId, description: item.description,
    rating: item.rating.toFixed(2), editorialScore: item.editorialScore.toFixed(2),
    status: 'active' as const, updatedAt: new Date().toISOString(),
  }
  let productId = existingOffer?.productId ?? existingBySlug?.id
  const isNew = !productId
  if (productId) await db.update(products).set(productValues).where(eq(products.id, productId))
  else {
    const [created] = await db.insert(products).values(productValues).returning({ id: products.id })
    productId = created.id
  }

  await db.delete(productCategories).where(eq(productCategories.productId, productId))
  await db.insert(productCategories).values({ productId, categoryId, isPrimary: true })

  await db.delete(productImages).where(eq(productImages.productId, productId))
  await db.insert(productImages).values({ productId, providerId, sourceUrl: item.imageUrl, isPrimary: true, position: 0 })

  await db.delete(productTags).where(eq(productTags.productId, productId))
  for (const label of item.tags) {
    const tagId = await getOrCreateTag(label)
    await db.insert(productTags).values({ productId, tagId }).onConflictDoNothing()
  }

  const offerValues = {
    productId, providerId, externalId: item.externalId, externalUrl: item.externalUrl, affiliateUrl: item.affiliateUrl,
    price: item.price.toFixed(2), priceMax: item.priceMax?.toFixed(2) ?? null, originalPrice: item.originalPrice?.toFixed(2) ?? null,
    discountPercentage: item.discountPercentage.toFixed(2), commissionRate: item.commissionRate.toFixed(4),
    estimatedCommission: item.estimatedCommission.toFixed(2), availability: 'in_stock' as const,
    sellerName: item.sellerName, rating: item.rating.toFixed(2), soldCount: item.soldCount,
    status: 'active' as const, lastSyncedAt: new Date().toISOString(),
  }
  const [offer] = await db.insert(offers).values(offerValues)
    .onConflictDoUpdate({ target: [offers.externalId, offers.providerId], set: offerValues })
    .returning({ id: offers.id })

  const priceChanged = !existingOffer || Number(existingOffer.price) !== item.price
  if (priceChanged) {
    await db.insert(priceHistory).values({
      offerId: offer.id, price: item.price.toFixed(2), originalPrice: item.originalPrice?.toFixed(2) ?? null,
    })
  }
  return { isNew, priceChanged }
}

export async function importCatalogItems(items: CatalogItem[], providerId: string, categoryNames: Record<string, string>): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, priceChanges: 0 }
  for (const item of items) {
    const result = await importCatalogItem(item, providerId, categoryNames[item.categorySlug] ?? item.categorySlug)
    if (result.isNew) summary.created++; else summary.updated++
    if (result.priceChanged) summary.priceChanges++
  }
  return summary
}

/**
 * Tira da vitrine os produtos sem oferta de afiliado válida — os de demonstração, que não geram
 * comissão. Arquiva em vez de apagar: o catálogo só lê o que está `active`, e nada se perde.
 */
export async function archiveProductsWithoutAffiliateOffer() {
  const orphans = await db.select({ id: products.id, slug: products.slug })
    .from(products)
    .leftJoin(offers, and(eq(offers.productId, products.id), sql`${offers.affiliateUrl} is not null`))
    .where(and(isNull(offers.id), eq(products.status, 'active')))
  for (const orphan of orphans) {
    await db.update(products).set({ status: 'removed', updatedAt: new Date().toISOString() }).where(eq(products.id, orphan.id))
    await db.update(offers).set({ status: 'removed' }).where(eq(offers.productId, orphan.id))
  }
  return orphans.map((orphan) => orphan.slug)
}

export async function countCatalog() {
  const [row] = await db.select({
    products: sql<number>`count(distinct ${products.id})::int`,
    offers: sql<number>`count(${offers.id})::int`,
    withAffiliate: sql<number>`count(${offers.affiliateUrl})::int`,
  }).from(products).leftJoin(offers, eq(offers.productId, products.id)).where(eq(products.status, 'active'))
  return row
}

export async function latestSyncedAt() {
  const [row] = await db.select({ at: offers.lastSyncedAt }).from(offers).orderBy(desc(offers.lastSyncedAt)).limit(1)
  return row?.at ?? null
}
