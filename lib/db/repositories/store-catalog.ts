import { unstable_cache } from 'next/cache'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { brands, categories, curatedCollections, offers, priceHistory, productAttributeValues, productAttributes, productCategories, productImages, productTags, products, providers, tags } from '../schema'
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

/** `syncedAt`: última sincronização de oferta com a Shopee (ISO), para a interface dizer a data real. */
export type CuratedInput = { slug: string; title: string; tone: string; description: string; productIds: string[] }
export type StoreCatalog = { products: Product[]; offers: Offer[]; providers: Provider[]; categories: Category[]; syncedAt: string | null; curated: CuratedInput[] }

/** Pontos de histórico de preço lidos por oferta (os mais recentes). O banco guarda um por mudança de preço ou de vendas. */
const HISTORY_POINTS = 12

/**
 * O catálogo é lido em fragmentos (por hash do id do produto) para que cada entrada do cache fique bem abaixo do
 * limite de 2 MB do cache de dados do Next, qualquer que seja o tamanho do catálogo.
 */
export const CATALOG_SHARDS = 8

type Part = Pick<StoreCatalog, 'products' | 'offers'>

/** Produtos ativos (e suas ofertas, imagens, selos, fichas e histórico) de um fragmento, ou de todos quando `shard` é null. */
async function loadProducts(shard: number | null): Promise<Part> {
  const productRows = await db.select().from(products).where(
    shard === null
      ? eq(products.status, 'active')
      : and(eq(products.status, 'active'), sql`mod(abs(hashtext(${products.id}::text)), ${CATALOG_SHARDS}) = ${shard}`),
  )
  const productIds = productRows.map((row) => row.id)
  if (productIds.length === 0) return { products: [], offers: [] }
  const [offerRows, brandRows, categoryRows, productCategoryRows, imageRows, tagRows, attributeValueRows] = await Promise.all([
    db.select().from(offers).where(and(eq(offers.status, 'active'), inArray(offers.productId, productIds))),
    db.select().from(brands),
    db.select().from(categories),
    db.select().from(productCategories).where(inArray(productCategories.productId, productIds)),
    db.select().from(productImages).where(inArray(productImages.productId, productIds)),
    db.select({ productId: productTags.productId, label: tags.label }).from(productTags).innerJoin(tags, eq(productTags.tagId, tags.id)).where(inArray(productTags.productId, productIds)),
    db.select({ productId: productAttributeValues.productId, label: productAttributes.label, valueText: productAttributeValues.valueText })
      .from(productAttributeValues).innerJoin(productAttributes, eq(productAttributeValues.attributeId, productAttributes.id)).where(inArray(productAttributeValues.productId, productIds)),
  ])

  // Só os últimos pontos de cada oferta: a tabela cresce a cada importação e ler tudo não escala.
  const offerIds = offerRows.map((row) => row.id)
  const historyResult = offerIds.length === 0 ? { rows: [] as { offer_id: string; captured_at: string; price: string }[] } : await db.execute(sql`
    select offer_id, captured_at, price from (
      select offer_id, captured_at, price, row_number() over (partition by offer_id order by captured_at desc) as rn
      from price_history where offer_id in (${sql.join(offerIds.map((id) => sql`${id}`), sql`, `)})
    ) recent where rn <= ${HISTORY_POINTS} order by captured_at asc`)
  const priceHistoryRows = historyResult.rows as { offer_id: string; captured_at: string; price: string }[]

  const brandById = new Map(brandRows.map((row) => [row.id, row]))
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]))
  const categoryByProduct = new Map(productCategoryRows.filter((row) => row.isPrimary).map((row) => [row.productId, categoryById.get(row.categoryId)]))
  const imagesByProduct = new Map<string, string[]>()
  for (const image of [...imageRows].sort((a, b) => a.position - b.position)) imagesByProduct.set(image.productId, [...(imagesByProduct.get(image.productId) ?? []), image.sourceUrl])
  const tagsByProduct = new Map<string, string[]>()
  for (const tag of tagRows) tagsByProduct.set(tag.productId, [...(tagsByProduct.get(tag.productId) ?? []), tag.label])
  const priceHistoryByOffer = new Map<string, { month: string; price: number }[]>()
  for (const point of priceHistoryRows) {
    const month = monthLabels[new Date(point.captured_at).getMonth()]
    priceHistoryByOffer.set(point.offer_id, [...(priceHistoryByOffer.get(point.offer_id) ?? []), { month, price: Number(point.price) }])
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
      specs: specsByProduct.get(row.id) ?? {}, priceHistory: priceHistoryByProduct.get(row.id) ?? [], createdAt: row.createdAt,
    }
  })

  const storeOffers: Offer[] = offerRows.map((row) => ({
    id: row.id, productId: row.productId, providerId: row.providerId, price: Number(row.price),
    previousPrice: row.originalPrice ? Number(row.originalPrice) : undefined, shipping: 0, installment: '',
    stock: availabilityToStock[row.availability] ?? 'disponível', url: row.affiliateUrl ?? row.externalUrl, updatedAt: relativeUpdatedAt(row.lastSyncedAt),
    soldCount: row.soldCount ?? undefined,
    priceMax: row.priceMax ? Number(row.priceMax) : undefined,
    commissionRate: row.commissionRate ? Number(row.commissionRate) : undefined,
  }))
  return { products: storeProducts, offers: storeOffers }
}

type Meta = Pick<StoreCatalog, 'providers' | 'categories' | 'syncedAt' | 'curated'>

/** O que não cresce com o catálogo: provedores, categorias, coleções manuais e a data da última sincronização. */
async function loadMeta(): Promise<Meta> {
  const [providerRows, categoryRows, curatedRows, synced] = await Promise.all([
    db.select().from(providers),
    db.select().from(categories),
    db.select().from(curatedCollections).where(eq(curatedCollections.status, 'published')),
    db.execute(sql`select max(last_synced_at) as at from offers where status = 'active'`),
  ])
  const storeProviders: Provider[] = providerRows.map((row) => ({
    id: row.id, name: row.displayName, slug: row.code, rating: 4.5, verified: row.status === 'active', color: '#0d2440',
  }))
  const storeCategories: Category[] = categoryRows.map((row) => ({
    id: row.id, name: row.name, slug: row.slug, icon: 'Sparkles', description: '',
  }))
  const at = (synced.rows[0] as { at: string | null } | undefined)?.at
  const curated: CuratedInput[] = curatedRows.map((row) => ({
    slug: row.slug, title: row.title, tone: row.tone, description: row.description,
    productIds: Array.isArray(row.productIds) ? (row.productIds as unknown[]).map(String) : [],
  }))
  return { providers: storeProviders, categories: storeCategories, syncedAt: at ? new Date(at).toISOString() : null, curated }
}

const assemble = (parts: Part[], meta: Meta): StoreCatalog => ({
  products: parts.flatMap((part) => part.products), offers: parts.flatMap((part) => part.offers), ...meta,
})

/** Leitura direta, sem cache: testes, scripts e fora do runtime do Next. */
async function loadStoreCatalog(): Promise<StoreCatalog> {
  const [part, meta] = await Promise.all([loadProducts(null), loadMeta()])
  return assemble([part], meta)
}

const cachedShards = Array.from({ length: CATALOG_SHARDS }, (_, shard) => unstable_cache(() => loadProducts(shard), ['store-catalog-v2', String(shard)], { revalidate: 86400, tags: ['catalog'] }))
const cachedMeta = unstable_cache(loadMeta, ['store-catalog-meta-v2'], { revalidate: 86400, tags: ['catalog'] })

/**
 * Catálogo da vitrine com cache entre requisições (5 min), em fragmentos. A importação agendada chama
 * `revalidateTag('catalog', 'max')` para a mudança aparecer logo. Fora do runtime do Next
 * (testes, scripts) o cache não existe e a leitura vai direto ao banco.
 */
export async function getStoreCatalog(): Promise<StoreCatalog> {
  try {
    const [parts, meta] = await Promise.all([Promise.all(cachedShards.map((load) => load())), cachedMeta()])
    return assemble(parts, meta)
  } catch (error) {
    if (error instanceof Error && /incrementalCache|static generation store/i.test(error.message)) return loadStoreCatalog()
    throw error
  }
}
