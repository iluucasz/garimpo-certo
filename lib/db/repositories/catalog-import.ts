import { and, eq, inArray, isNull, desc, sql } from 'drizzle-orm'
import { db } from '../client'
import { brands, categories, offers, priceHistory, productCategories, productImages, productTags, products, providers, tags } from '../schema'
import { slugify, type CatalogItem } from '@/lib/providers/shopee/mapping'
import { generateShortLink } from '@/lib/providers/shopee/client'
import { siteSubIds, subIdsKey } from '@/lib/providers/shopee/links'

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

/**
 * Link de afiliado do botão de compra, com a etiqueta de origem (`site-<categoria>`) para a Shopee atribuir a
 * comissão ao site e à categoria. O link só é gerado uma vez por oferta: enquanto a etiqueta não mudar, reaproveita.
 * Se a API falhar, cai no `offerLink` da própria API (vale comissão, só não tem etiqueta) e tenta de novo na próxima importação.
 */
export async function resolveAffiliateLink(
  item: Pick<CatalogItem, 'externalUrl' | 'affiliateUrl' | 'categorySlug'>,
  existing?: { affiliateUrl: string | null; affiliateSubIds: string | null },
) {
  if (process.env.SHOPEE_TAGGED_LINKS === '0') return { url: item.affiliateUrl, subIds: null as string | null }
  const subIds = siteSubIds(item.categorySlug)
  const key = subIdsKey(subIds)
  if (existing?.affiliateUrl && existing.affiliateSubIds === key) return { url: existing.affiliateUrl, subIds: key as string | null }
  try {
    return { url: await generateShortLink(item.externalUrl, subIds), subIds: key as string | null }
  } catch (error) {
    console.error('[import] não foi possível gerar o link com etiqueta', item.externalUrl, error instanceof Error ? error.message : error)
    if (existing?.affiliateUrl && existing.affiliateSubIds) return { url: existing.affiliateUrl, subIds: existing.affiliateSubIds as string | null }
    return { url: item.affiliateUrl, subIds: null as string | null }
  }
}

/** Grava (ou atualiza) um produto real e a oferta do parceiro, mantendo o histórico de preço. */
export async function importCatalogItem(item: CatalogItem, providerId: string, categoryName: string) {
  const brandId = await getOrCreateBrand(item.brandName)
  const categoryId = await getOrCreateCategory(item.categorySlug, categoryName)

  const [existingOffer] = await db.select({
    id: offers.id, productId: offers.productId, price: offers.price, soldCount: offers.soldCount,
    affiliateUrl: offers.affiliateUrl, affiliateSubIds: offers.affiliateSubIds, rating: offers.rating, status: offers.status,
    priceMax: offers.priceMax, originalPrice: offers.originalPrice,
  }).from(offers).where(and(eq(offers.providerId, providerId), eq(offers.externalId, item.externalId)))
  // Reatualização sem mudança (mesmo preço, vendas, nota e faixa): só o carimbo de sincronização. Com milhares de
  // produtos reatualizados todo dia, regravar imagem, selos e categoria de cada um seria trabalho à toa.
  const same = (a: string | null, b: number | null | undefined) => (a === null || a === undefined ? b === null || b === undefined : b !== null && b !== undefined && Number(a).toFixed(2) === b.toFixed(2))
  const taggedKey = process.env.SHOPEE_TAGGED_LINKS === '0' ? null : subIdsKey(siteSubIds(item.categorySlug))
  if (existingOffer && existingOffer.status === 'active' && existingOffer.affiliateUrl && (taggedKey === null || existingOffer.affiliateSubIds === taggedKey)
    && Number(existingOffer.price).toFixed(2) === item.price.toFixed(2) && (existingOffer.soldCount ?? -1) === item.soldCount
    && same(existingOffer.rating, item.rating) && same(existingOffer.priceMax, item.priceMax) && same(existingOffer.originalPrice, item.originalPrice)) {
    await db.update(offers).set({ lastSyncedAt: new Date().toISOString() }).where(eq(offers.id, existingOffer.id))
    return { isNew: false, priceChanged: false }
  }
  const [existingBySlug] = existingOffer ? [] : await db.select({ id: products.id }).from(products).where(eq(products.slug, item.slug))
  const knownProductId = existingOffer?.productId ?? existingBySlug?.id
  const [lockRow] = knownProductId ? await db.select({ locked: products.editorialLocked }).from(products).where(eq(products.id, knownProductId)) : []
  // Editado pelo painel: a importação só atualiza o que vem da Shopee (nota, índice, preço), nunca o texto e a classificação.
  const locked = Boolean(lockRow?.locked)

  const productValues = {
    slug: item.slug, name: item.name, brandId, description: item.description,
    rating: item.rating.toFixed(2), editorialScore: item.editorialScore.toFixed(2),
    status: 'active' as const, updatedAt: new Date().toISOString(),
  }
  let productId = existingOffer?.productId ?? existingBySlug?.id
  const isNew = !productId
  if (productId && locked) {
    await db.update(products).set({ rating: productValues.rating, editorialScore: productValues.editorialScore, updatedAt: productValues.updatedAt }).where(eq(products.id, productId))
  } else if (productId) await db.update(products).set(productValues).where(eq(products.id, productId))
  else {
    const [created] = await db.insert(products).values(productValues).returning({ id: products.id })
    productId = created.id
  }

  if (!locked) {
    await db.delete(productCategories).where(eq(productCategories.productId, productId))
    await db.insert(productCategories).values({ productId, categoryId, isPrimary: true })
  }

  // A imagem acompanha a Shopee mesmo com o bloqueio: é dado do fornecedor, não editorial.
  await db.delete(productImages).where(eq(productImages.productId, productId))
  await db.insert(productImages).values({ productId, providerId, sourceUrl: item.imageUrl, isPrimary: true, position: 0 })

  if (!locked) {
    await db.delete(productTags).where(eq(productTags.productId, productId))
    for (const label of item.tags) {
      const tagId = await getOrCreateTag(label)
      await db.insert(productTags).values({ productId, tagId }).onConflictDoNothing()
    }
  }

  const link = await resolveAffiliateLink(item, existingOffer)
  const offerValues = {
    productId, providerId, externalId: item.externalId, externalUrl: item.externalUrl,
    affiliateUrl: link.url, affiliateSubIds: link.subIds,
    price: item.price.toFixed(2), priceMax: item.priceMax?.toFixed(2) ?? null, originalPrice: item.originalPrice?.toFixed(2) ?? null,
    discountPercentage: item.discountPercentage.toFixed(2), commissionRate: item.commissionRate.toFixed(4),
    estimatedCommission: item.estimatedCommission.toFixed(2), availability: 'in_stock' as const,
    sellerName: item.sellerName, rating: item.rating.toFixed(2), soldCount: item.soldCount,
    status: 'active' as const, lastSyncedAt: new Date().toISOString(),
  }
  const [offer] = await db.insert(offers).values(offerValues)
    .onConflictDoUpdate({ target: [offers.externalId, offers.providerId], set: offerValues })
    .returning({ id: offers.id })

  // Snapshot a cada mudança de preço OU de vendas: é o histórico que a Shopee não devolve.
  const priceChanged = !existingOffer || Number(existingOffer.price) !== item.price
  const soldChanged = !existingOffer || (existingOffer.soldCount ?? -1) !== item.soldCount
  if (priceChanged || soldChanged) {
    await db.insert(priceHistory).values({
      offerId: offer.id, price: item.price.toFixed(2), originalPrice: item.originalPrice?.toFixed(2) ?? null,
      soldCount: item.soldCount,
    })
  }
  return { isNew, priceChanged: priceChanged || soldChanged }
}

/** Quantos produtos são gravados ao mesmo tempo. Cada produto é independente; marcas e selos já são seguros contra corrida. */
const WRITE_CONCURRENCY = 4

export async function importCatalogItems(items: CatalogItem[], providerId: string, categoryNames: Record<string, string>): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, priceChanges: 0 }
  // Categorias não têm unicidade no banco: cria-as em sequência antes de paralelizar, para nunca duplicar.
  for (const slug of new Set(items.map((item) => item.categorySlug))) await getOrCreateCategory(slug, categoryNames[slug] ?? slug)

  for (let start = 0; start < items.length; start += WRITE_CONCURRENCY) {
    const chunk = items.slice(start, start + WRITE_CONCURRENCY)
    const results = await Promise.all(chunk.map((item) => importCatalogItem(item, providerId, categoryNames[item.categorySlug] ?? item.categorySlug)))
    for (const result of results) {
      if (result.isNew) summary.created++; else summary.updated++
      if (result.priceChanged) summary.priceChanges++
    }
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

/** Arquiva produtos ativos do parceiro que não estão mais na seleção da importação atual. */
export async function archiveProductsOutsideSelection(externalIds: string[], providerId: string) {
  const mantidos = new Set(externalIds)
  const ativos = await db.select({ id: products.id, slug: products.slug, externalId: offers.externalId })
    .from(products).innerJoin(offers, eq(offers.productId, products.id))
    .where(and(eq(products.status, 'active'), eq(offers.providerId, providerId)))
  const sobrando = ativos.filter((row) => !mantidos.has(row.externalId))
  for (const row of sobrando) {
    await db.update(products).set({ status: 'removed', updatedAt: new Date().toISOString() }).where(eq(products.id, row.id))
    await db.update(offers).set({ status: 'removed' }).where(eq(offers.productId, row.id))
  }
  return sobrando.map((row) => row.slug)
}

export type KnownProduct = {
  externalId: string
  name: string
  status: string
  sellerName: string | null
  categorySlug: string | null
  lastSyncedAt: string | null
}

/** Provedor já cadastrado (sem criar nada); '' quando ainda não existe. */
export async function findProviderId(code: string) {
  const [row] = await db.select({ id: providers.id }).from(providers).where(eq(providers.code, code))
  return row?.id ?? ''
}

/**
 * Tudo o que o parceiro já tem no banco, ativo ou não: a importação que acumula usa isto para não repetir produtos
 * e para reatualizar os mais antigos.
 */
export async function listKnownProducts(providerId: string): Promise<KnownProduct[]> {
  const rows = await db.select({
    externalId: offers.externalId, name: products.name, status: products.status, sellerName: offers.sellerName,
    categorySlug: categories.slug, lastSyncedAt: offers.lastSyncedAt,
  }).from(offers)
    .innerJoin(products, eq(products.id, offers.productId))
    .leftJoin(productCategories, and(eq(productCategories.productId, products.id), eq(productCategories.isPrimary, true)))
    .leftJoin(categories, eq(categories.id, productCategories.categoryId))
    .where(eq(offers.providerId, providerId))
  const byId = new Map<string, KnownProduct>()
  for (const row of rows) if (!byId.has(row.externalId)) byId.set(row.externalId, { ...row, status: String(row.status) })
  return [...byId.values()]
}

/** Arquiva (nunca apaga) os produtos do parceiro com estes ids externos. */
export async function archiveProductsByExternalIds(externalIds: string[], providerId: string) {
  if (externalIds.length === 0) return [] as string[]
  const rows = await db.select({ id: products.id, slug: products.slug })
    .from(products).innerJoin(offers, eq(offers.productId, products.id))
    .where(and(eq(products.status, 'active'), eq(offers.providerId, providerId), inArray(offers.externalId, externalIds)))
  for (const row of rows) {
    await db.update(products).set({ status: 'removed', updatedAt: new Date().toISOString() }).where(eq(products.id, row.id))
    await db.update(offers).set({ status: 'removed' }).where(eq(offers.productId, row.id))
  }
  return rows.map((row) => row.slug)
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
