/**
 * Acesso a dados dos recursos do painel. Cada recurso expõe `list`, `get` e, quando permitido, `create`,
 * `update` e `remove`. A autorização, a trilha de auditoria e a invalidação de cache ficam nas rotas
 * (app/api/v1/admin/resources/...); aqui só entra regra de dados.
 */
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { getCouponClickStats, type CouponClickStats } from '@/lib/db/repositories/coupon-clicks'
import {
  analyticsEvents, auditLogs, brands, campaigns, categories, contentPages, coupons, curatedCollections,
  featureFlags, offers, privacyRequests, productCategories, productTags, products, providers, roles, segments,
  sessions, syncJobRuns, syncJobs, tags, userRoles, users,
} from '@/lib/db/schema'
import { isReservedCollectionSlug } from '@/lib/catalog/collections'
import { privacyRequestLabels } from '@/lib/privacy/requests'
import { formatPrice } from '@/lib/format'
import { resources, wiredFlags, type ResourceSlug } from './resource-meta'
import { validatePeriod, type Values } from './validate'

export type AdminRow = Record<string, unknown> & { id: string }
export type ListParams = { q: string; page: number; pageSize: number; filter: string }
export type ListResult = { rows: AdminRow[]; total: number }
export type Failure = { errors: Record<string, string>; status?: number }
export type Saved = { row: AdminRow }
export type Removed = { ok: true; before: AdminRow } | { error: string; status: number }

export type Handler = {
  list(params: ListParams): Promise<ListResult>
  get(id: string): Promise<AdminRow | null>
  create?(values: Values, actorId: string): Promise<Saved | Failure>
  update?(id: string, values: Values, actorId: string): Promise<Saved | Failure | null>
  remove?(id: string): Promise<Removed | null>
  /** Tags de cache a invalidar depois de uma alteração. */
  revalidate?: ('catalog' | 'settings')[]
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: string) => uuidPattern.test(value)
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)
const likeOf = (q: string) => (q.trim() ? `%${escapeLike(q.trim())}%` : null)
const nowIso = () => new Date().toISOString()
const dedupe = (items: string[]) => [...new Set(items)]
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const money = (value: string | number | null | undefined) => (value === null || value === undefined ? '—' : formatPrice(Number(value)))
const page = (params: ListParams) => ({ limit: params.pageSize, offset: (params.page - 1) * params.pageSize })

async function total(query: Promise<{ n: number }[]>) {
  const [row] = await query
  return row?.n ?? 0
}

async function existingIds(table: typeof categories | typeof tags | typeof products, ids: string[]) {
  if (!ids.length) return []
  const rows = await db.select({ id: table.id }).from(table).where(inArray(table.id, ids))
  const found = new Set(rows.map((row) => row.id))
  return ids.filter((id) => found.has(id))
}

// ---------------------------------------------------------------- produtos
const productOffersSql = (column: 'price' | 'sold_count') => sql<string | null>`(select ${sql.raw(column === 'price' ? 'min(o.price)' : 'max(o.sold_count)')} from offers o where o.product_id = ${products.id} and o.status = 'active')`

const productsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const status = (['active', 'unavailable', 'discontinued', 'removed'] as const).find((value) => value === params.filter)
    const where = and(
      like ? or(ilike(products.name, like), ilike(products.slug, like)) : undefined,
      status ? eq(products.status, status) : undefined,
    )
    const [rows, count] = await Promise.all([
      db.select({
        id: products.id, name: products.name, slug: products.slug, status: products.status, description: products.description,
        editorialLocked: products.editorialLocked, brandName: brands.name,
        price: productOffersSql('price'), soldCount: productOffersSql('sold_count'),
        categories: sql<string | null>`(select string_agg(c.name, ', ' order by c.name) from product_categories pc join categories c on c.id = pc.category_id where pc.product_id = ${products.id})`,
      }).from(products).leftJoin(brands, eq(brands.id, products.brandId)).where(where)
        .orderBy(desc(products.updatedAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(products).where(where)),
    ])
    return {
      total: count,
      rows: rows.map((row) => ({
        ...row,
        price: money(row.price),
        soldCount: row.soldCount === null ? '—' : Number(row.soldCount).toLocaleString('pt-BR'),
        categories: row.categories ?? '—',
      })),
    }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select({
      id: products.id, name: products.name, slug: products.slug, status: products.status, description: products.description,
      editorialLocked: products.editorialLocked, brandName: brands.name,
    }).from(products).leftJoin(brands, eq(brands.id, products.brandId)).where(eq(products.id, id))
    if (!row) return null
    const [cats, tgs] = await Promise.all([
      db.select({ id: productCategories.categoryId }).from(productCategories).where(eq(productCategories.productId, id)),
      db.select({ id: productTags.tagId }).from(productTags).where(eq(productTags.productId, id)),
    ])
    return { ...row, categoryIds: cats.map((item) => item.id).sort(), tagIds: tgs.map((item) => item.id).sort() }
  },
  async update(id, values) {
    const before = await this.get(id)
    if (!before) return null
    const patch: Partial<typeof products.$inferInsert> = { updatedAt: nowIso() }
    if ('name' in values) patch.name = String(values.name)
    if ('status' in values) patch.status = values.status as typeof products.$inferInsert.status
    if ('description' in values) patch.description = (values.description as string | null) ?? null

    const categoryIds = 'categoryIds' in values ? await existingIds(categories, values.categoryIds as string[]) : null
    const tagIds = 'tagIds' in values ? await existingIds(tags, values.tagIds as string[]) : null

    const editorialChange = ['name', 'status', 'description'].some((key) => key in values && !same(values[key], before[key]))
      || (categoryIds !== null && !same([...categoryIds].sort(), before.categoryIds))
      || (tagIds !== null && !same([...tagIds].sort(), before.tagIds))
    if ('editorialLocked' in values && values.editorialLocked !== before.editorialLocked) patch.editorialLocked = Boolean(values.editorialLocked)
    else if (editorialChange) patch.editorialLocked = true

    await db.update(products).set(patch).where(eq(products.id, id))
    if (categoryIds) {
      await db.delete(productCategories).where(eq(productCategories.productId, id))
      if (categoryIds.length) await db.insert(productCategories).values(categoryIds.map((categoryId, index) => ({ productId: id, categoryId, isPrimary: index === 0 })))
    }
    if (tagIds) {
      await db.delete(productTags).where(eq(productTags.productId, id))
      if (tagIds.length) await db.insert(productTags).values(tagIds.map((tagId) => ({ productId: id, tagId })))
    }
    return { row: (await this.get(id))! }
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    // Arquivar, nunca apagar: histórico de preço e cliques dependem do produto. Bloqueado para a importação não reviver.
    await db.update(products).set({ status: 'removed', editorialLocked: true, updatedAt: nowIso() }).where(eq(products.id, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- ofertas
const offersHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const status = (['active', 'inactive', 'removed'] as const).find((value) => value === params.filter)
    const where = and(
      like ? or(ilike(products.name, like), ilike(offers.sellerName, like)) : undefined,
      status ? eq(offers.status, status) : undefined,
    )
    const [rows, count] = await Promise.all([
      db.select({
        id: offers.id, productName: products.name, providerName: providers.displayName, sellerName: offers.sellerName,
        price: offers.price, priceMax: offers.priceMax, commissionRate: offers.commissionRate, status: offers.status, syncedAt: offers.lastSyncedAt,
      }).from(offers).innerJoin(products, eq(products.id, offers.productId)).innerJoin(providers, eq(providers.id, offers.providerId))
        .where(where).orderBy(desc(offers.lastSyncedAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(offers).innerJoin(products, eq(products.id, offers.productId)).where(where)),
    ])
    return {
      total: count,
      rows: rows.map((row) => ({
        id: row.id, productName: row.productName, providerName: row.providerName, sellerName: row.sellerName ?? '—',
        price: row.priceMax && Number(row.priceMax) > Number(row.price) ? `${money(row.price)} a ${money(row.priceMax)}` : money(row.price),
        commission: row.commissionRate === null ? '—' : `${(Number(row.commissionRate) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
        status: row.status, syncedAt: row.syncedAt,
      })),
    }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 1000, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const [updated] = await db.update(offers).set({ status: values.status as typeof offers.$inferInsert.status }).where(eq(offers.id, id)).returning({ id: offers.id })
    if (!updated) return null
    return { row: { id, status: values.status } as AdminRow }
  },
}

// ---------------------------------------------------------------- provedores
const providersHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = like ? or(ilike(providers.displayName, like), ilike(providers.code, like)) : undefined
    const rows = await db.select({
      id: providers.id, displayName: providers.displayName, code: providers.code, status: providers.status,
      offers: sql<number>`(select count(*)::int from offers o where o.provider_id = ${providers.id} and o.status = 'active')`,
      syncedAt: sql<string | null>`(select max(o.last_synced_at) from offers o where o.provider_id = ${providers.id})`,
    }).from(providers).where(where).orderBy(asc(providers.displayName))
    return { rows, total: rows.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 100, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const patch: Partial<typeof providers.$inferInsert> = {}
    if ('displayName' in values) patch.displayName = String(values.displayName)
    if ('status' in values) patch.status = values.status as typeof providers.$inferInsert.status
    const [updated] = await db.update(providers).set(patch).where(eq(providers.id, id)).returning({ id: providers.id })
    if (!updated) return null
    return { row: (await this.get(id))! }
  },
}

// ---------------------------------------------------------------- categorias, marcas, tags
const categoriesHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = like ? or(ilike(categories.name, like), ilike(categories.slug, like)) : undefined
    const rows = await db.select({
      id: categories.id, name: categories.name, slug: categories.slug, sortOrder: categories.sortOrder,
      products: sql<number>`(select count(*)::int from product_categories pc join products p on p.id = pc.product_id where pc.category_id = ${categories.id} and p.status = 'active')`,
    }).from(categories).where(where).orderBy(asc(categories.sortOrder), asc(categories.name))
    return { rows, total: rows.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 500, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
  async create(values) {
    const slug = String(values.slug)
    const [clash] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug))
    if (clash) return { errors: { slug: 'Já existe uma categoria com esse endereço.' }, status: 409 }
    const [created] = await db.insert(categories).values({ name: String(values.name), slug, path: `/${slug}`, depth: 0, sortOrder: Number(values.sortOrder ?? 0) }).returning({ id: categories.id })
    return { row: (await this.get(created.id))! }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const patch: Partial<typeof categories.$inferInsert> = {}
    if ('name' in values) patch.name = String(values.name)
    if ('sortOrder' in values) patch.sortOrder = Number(values.sortOrder ?? 0)
    if (Object.keys(patch).length) {
      const [updated] = await db.update(categories).set(patch).where(eq(categories.id, id)).returning({ id: categories.id })
      if (!updated) return null
    }
    const row = await this.get(id)
    return row ? { row } : null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(productCategories).where(eq(productCategories.categoryId, id))
    if (n > 0) return { error: `Esta categoria ainda tem ${n} produto${n === 1 ? '' : 's'}. Mova-os para outra categoria antes de apagar.`, status: 409 }
    await db.delete(categories).where(eq(categories.id, id))
    return { ok: true, before }
  },
}

const brandsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = like ? or(ilike(brands.name, like), ilike(brands.slug, like)) : undefined
    const [rows, count] = await Promise.all([
      db.select({
        id: brands.id, name: brands.name, slug: brands.slug,
        products: sql<number>`(select count(*)::int from products p where p.brand_id = ${brands.id} and p.status = 'active')`,
      }).from(brands).where(where).orderBy(asc(brands.name)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(brands).where(where)),
    ])
    return { rows, total: count }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select({ id: brands.id, name: brands.name, slug: brands.slug }).from(brands).where(eq(brands.id, id))
    return row ?? null
  },
  async create(values) {
    const slug = String(values.slug)
    const [clash] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug))
    if (clash) return { errors: { slug: 'Já existe uma marca com esse endereço.' }, status: 409 }
    const [created] = await db.insert(brands).values({ name: String(values.name), slug }).returning({ id: brands.id })
    return { row: (await this.get(created.id))! }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const [updated] = await db.update(brands).set({ name: String(values.name) }).where(eq(brands.id, id)).returning({ id: brands.id })
    return updated ? { row: (await this.get(id))! } : null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.brandId, id))
    if (n > 0) return { error: `Esta marca ainda tem ${n} produto${n === 1 ? '' : 's'} (incluindo arquivados) e não pode ser apagada.`, status: 409 }
    await db.delete(brands).where(eq(brands.id, id))
    return { ok: true, before }
  },
}

const tagsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = like ? or(ilike(tags.label, like), ilike(tags.code, like)) : undefined
    const rows = await db.select({
      id: tags.id, label: tags.label, code: tags.code,
      products: sql<number>`(select count(*)::int from product_tags pt where pt.tag_id = ${tags.id})`,
    }).from(tags).where(where).orderBy(asc(tags.label))
    return { rows, total: rows.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select({ id: tags.id, label: tags.label, code: tags.code }).from(tags).where(eq(tags.id, id))
    return row ?? null
  },
  async create(values) {
    const code = String(values.code)
    const [clash] = await db.select({ id: tags.id }).from(tags).where(eq(tags.code, code))
    if (clash) return { errors: { code: 'Já existe um selo com esse código.' }, status: 409 }
    const [created] = await db.insert(tags).values({ code, label: String(values.label) }).returning({ id: tags.id })
    return { row: (await this.get(created.id))! }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const [updated] = await db.update(tags).set({ label: String(values.label) }).where(eq(tags.id, id)).returning({ id: tags.id })
    return updated ? { row: (await this.get(id))! } : null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(tags).where(eq(tags.id, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- coleções manuais
const collectionRow = (row: typeof curatedCollections.$inferSelect): AdminRow => ({
  id: row.id, title: row.title, slug: row.slug, tone: row.tone, description: row.description, status: row.status,
  productIds: Array.isArray(row.productIds) ? row.productIds as string[] : [],
  count: Array.isArray(row.productIds) ? (row.productIds as unknown[]).length : 0,
})

const collectionsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = and(like ? or(ilike(curatedCollections.title, like), ilike(curatedCollections.slug, like)) : undefined, params.filter ? eq(curatedCollections.status, params.filter) : undefined)
    const rows = await db.select().from(curatedCollections).where(where).orderBy(desc(curatedCollections.updatedAt))
    return { rows: rows.map(collectionRow), total: rows.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select().from(curatedCollections).where(eq(curatedCollections.id, id))
    return row ? collectionRow(row) : null
  },
  async create(values) {
    const slug = String(values.slug)
    if (isReservedCollectionSlug(slug)) return { errors: { slug: 'Esse endereço já é de uma coleção automática.' }, status: 409 }
    const [clash] = await db.select({ id: curatedCollections.id }).from(curatedCollections).where(eq(curatedCollections.slug, slug))
    if (clash) return { errors: { slug: 'Já existe uma coleção com esse endereço.' }, status: 409 }
    const productIds = await existingIds(products, (values.productIds as string[] | undefined) ?? [])
    const [created] = await db.insert(curatedCollections).values({
      slug, title: String(values.title), tone: String(values.tone), description: String(values.description),
      status: String(values.status ?? 'draft'), productIds,
    }).returning()
    return { row: collectionRow(created) }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const patch: Partial<typeof curatedCollections.$inferInsert> = { updatedAt: nowIso() }
    for (const key of ['title', 'tone', 'description', 'status'] as const) if (key in values) patch[key] = String(values[key])
    if ('productIds' in values) {
      const wanted = values.productIds as string[]
      const found = new Set(await existingIds(products, wanted))
      patch.productIds = wanted.filter((productId) => found.has(productId))
    }
    const [updated] = await db.update(curatedCollections).set(patch).where(eq(curatedCollections.id, id)).returning()
    return updated ? { row: collectionRow(updated) } : null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(curatedCollections).where(eq(curatedCollections.id, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- campanhas
const campaignRow = (row: typeof campaigns.$inferSelect, clicks = 0): AdminRow => ({ ...row, clicks: clicks.toLocaleString('pt-BR') })

const campaignsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = and(like ? or(ilike(campaigns.title, like), ilike(campaigns.headline, like)) : undefined, params.filter ? eq(campaigns.status, params.filter) : undefined)
    const rows = await db.select().from(campaigns).where(where).orderBy(asc(campaigns.sortOrder), desc(campaigns.updatedAt))
    const counts = rows.length
      ? await db.select({ slug: analyticsEvents.campaignId, n: sql<number>`count(*)::int` }).from(analyticsEvents)
        .where(and(eq(analyticsEvents.eventName, 'campaign_click'), inArray(analyticsEvents.campaignId, rows.map((row) => row.slug)))).groupBy(analyticsEvents.campaignId)
      : []
    const byCampaign = new Map(counts.map((row) => [row.slug, row.n]))
    return { rows: rows.map((row) => campaignRow(row, byCampaign.get(row.slug) ?? 0)), total: rows.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    return row ? campaignRow(row) : null
  },
  async create(values): Promise<Saved | Failure> {
    const period = validatePeriod(values)
    if (period) return { errors: { endsAt: period } }
    const [clash] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.slug, String(values.slug)))
    if (clash) return { errors: { slug: 'Já existe uma campanha com esse identificador.' }, status: 409 }
    const [created] = await db.insert(campaigns).values({
      slug: String(values.slug), title: String(values.title), headline: String(values.headline),
      description: (values.description as string | null) ?? null, ctaLabel: String(values.ctaLabel), ctaUrl: String(values.ctaUrl),
      imageUrl: (values.imageUrl as string | null) ?? null, status: String(values.status ?? 'draft'),
      startsAt: (values.startsAt as string | null) ?? null, endsAt: (values.endsAt as string | null) ?? null,
      sortOrder: Number(values.sortOrder ?? 0),
    }).returning()
    return { row: campaignRow(created) }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const [current] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!current) return null
    const period = validatePeriod({ startsAt: 'startsAt' in values ? values.startsAt : current.startsAt, endsAt: 'endsAt' in values ? values.endsAt : current.endsAt })
    if (period) return { errors: { endsAt: period } }
    const patch: Partial<typeof campaigns.$inferInsert> = { updatedAt: nowIso() }
    for (const key of ['title', 'headline', 'ctaLabel', 'ctaUrl', 'status'] as const) if (key in values) patch[key] = String(values[key])
    for (const key of ['description', 'imageUrl', 'startsAt', 'endsAt'] as const) if (key in values) patch[key] = (values[key] as string | null) ?? null
    if ('sortOrder' in values) patch.sortOrder = Number(values.sortOrder ?? 0)
    const [updated] = await db.update(campaigns).set(patch).where(eq(campaigns.id, id)).returning()
    return { row: campaignRow(updated) }
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(campaigns).where(eq(campaigns.id, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- artigos e páginas
function contentHandler(kind: 'article' | 'page'): Handler {
  const handler: Handler = {
    revalidate: ['catalog'],
    async list(params) {
      const like = likeOf(params.q)
      const where = and(eq(contentPages.kind, kind), like ? or(ilike(contentPages.title, like), ilike(contentPages.slug, like)) : undefined, params.filter ? eq(contentPages.status, params.filter) : undefined)
      const rows = await db.select().from(contentPages).where(where).orderBy(desc(contentPages.updatedAt))
      return { rows: rows.map((row) => ({ ...row })), total: rows.length }
    },
    async get(id) {
      if (!isUuid(id)) return null
      const [row] = await db.select().from(contentPages).where(and(eq(contentPages.id, id), eq(contentPages.kind, kind)))
      return row ? { ...row } : null
    },
    async create(values, actorId) {
      const slug = String(values.slug)
      const [clash] = await db.select({ id: contentPages.id }).from(contentPages).where(and(eq(contentPages.kind, kind), eq(contentPages.slug, slug)))
      if (clash) return { errors: { slug: 'Já existe um conteúdo com esse endereço.' }, status: 409 }
      const status = String(values.status ?? 'draft')
      const [created] = await db.insert(contentPages).values({
        kind, slug, title: String(values.title), summary: (values.summary as string | null) ?? null, body: String(values.body ?? ''),
        status, seoTitle: (values.seoTitle as string | null) ?? null, seoDescription: (values.seoDescription as string | null) ?? null,
        coverImageUrl: (values.coverImageUrl as string | null) ?? null, authorId: actorId,
        publishedAt: status === 'published' ? nowIso() : null,
      }).returning()
      return { row: { ...created } }
    },
    async update(id, values) {
      const current = await handler.get(id)
      if (!current) return null
      const patch: Partial<typeof contentPages.$inferInsert> = { updatedAt: nowIso() }
      for (const key of ['title', 'status'] as const) if (key in values) patch[key] = String(values[key])
      if ('body' in values) patch.body = String(values.body ?? '')
      for (const key of ['summary', 'seoTitle', 'seoDescription', 'coverImageUrl'] as const) if (key in values) patch[key] = (values[key] as string | null) ?? null
      if (patch.status === 'published' && !current.publishedAt) patch.publishedAt = nowIso()
      const [updated] = await db.update(contentPages).set(patch).where(eq(contentPages.id, id)).returning()
      return { row: { ...updated } }
    },
    async remove(id) {
      const before = await handler.get(id)
      if (!before) return null
      await db.delete(contentPages).where(eq(contentPages.id, id))
      return { ok: true, before }
    },
  }
  return handler
}

// ---------------------------------------------------------------- cupons
function couponSituation(row: typeof coupons.$inferSelect, now = Date.now()) {
  if (!row.isActive) return 'Oculto'
  if (row.endsAt && new Date(row.endsAt).getTime() < now) return 'Expirado'
  if (row.startsAt && new Date(row.startsAt).getTime() > now) return 'Agendado'
  return 'No ar'
}

const couponRow = (row: typeof coupons.$inferSelect, stats?: CouponClickStats): AdminRow => ({
  ...row,
  minSpend: row.minSpend === null ? null : Number(row.minSpend),
  source: row.source === 'manual' ? 'Cadastrado à mão' : 'Campanha da Shopee',
  rawSource: row.source,
  situation: couponSituation(row),
  clicks7d: stats?.clicks7d ?? 0,
  clicks30d: stats?.clicks30d ?? 0,
})

const couponsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const where = and(
      like ? or(ilike(coupons.title, like), ilike(coupons.code, like)) : undefined,
      params.filter ? eq(coupons.source, params.filter) : undefined,
    )
    const [rows, stats] = await Promise.all([
      db.select().from(coupons).where(where).orderBy(desc(coupons.isActive), sql`${coupons.endsAt} asc nulls last`, desc(coupons.createdAt)),
      getCouponClickStats(),
    ])
    return { rows: rows.map((row) => couponRow(row, stats.get(row.id))), total: rows.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select().from(coupons).where(eq(coupons.id, id))
    return row ? couponRow(row, (await getCouponClickStats()).get(row.id)) : null
  },
  async create(values) {
    const period = validatePeriod(values)
    if (period) return { errors: { endsAt: period } }
    const [created] = await db.insert(coupons).values({
      title: String(values.title), code: (values.code as string | null) ?? null, description: (values.description as string | null) ?? null,
      discountLabel: (values.discountLabel as string | null) ?? null,
      minSpend: values.minSpend === null || values.minSpend === undefined ? null : Number(values.minSpend).toFixed(2),
      url: String(values.url), imageUrl: (values.imageUrl as string | null) ?? null, source: 'manual',
      isActive: values.isActive === undefined ? true : Boolean(values.isActive),
      startsAt: (values.startsAt as string | null) ?? null, endsAt: (values.endsAt as string | null) ?? null,
    }).returning()
    return { row: couponRow(created) }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const [current] = await db.select().from(coupons).where(eq(coupons.id, id))
    if (!current) return null
    const period = validatePeriod({ startsAt: 'startsAt' in values ? values.startsAt : current.startsAt, endsAt: 'endsAt' in values ? values.endsAt : current.endsAt })
    if (period) return { errors: { endsAt: period } }
    const patch: Partial<typeof coupons.$inferInsert> = { updatedAt: nowIso() }
    if ('title' in values) patch.title = String(values.title)
    if ('url' in values) patch.url = String(values.url)
    for (const key of ['code', 'description', 'discountLabel', 'imageUrl', 'startsAt', 'endsAt'] as const) if (key in values) patch[key] = (values[key] as string | null) ?? null
    if ('minSpend' in values) patch.minSpend = values.minSpend === null ? null : Number(values.minSpend).toFixed(2)
    if ('isActive' in values) patch.isActive = Boolean(values.isActive)
    const [updated] = await db.update(coupons).set(patch).where(eq(coupons.id, id)).returning()
    return { row: couponRow(updated) }
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(coupons).where(eq(coupons.id, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- segmentos
export type SegmentCondition = { type: 'min_clicks' | 'category' | 'min_price' | 'max_price' | 'slot'; value: string | number }
export type SegmentRules = { windowDays: number; conditions: SegmentCondition[] }

export function parseSegmentRules(raw: unknown): SegmentRules {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Partial<SegmentRules> : {}
  const windowDays = Number.isFinite(Number(source.windowDays)) ? Math.min(365, Math.max(1, Math.round(Number(source.windowDays)))) : 30
  const types = ['min_clicks', 'category', 'min_price', 'max_price', 'slot']
  const conditions = (Array.isArray(source.conditions) ? source.conditions : [])
    .filter((item): item is SegmentCondition => Boolean(item) && types.includes((item as SegmentCondition).type) && String((item as SegmentCondition).value ?? '').trim() !== '')
    .slice(0, 8)
    .map((item) => ({ type: item.type, value: item.type === 'category' || item.type === 'slot' ? String(item.value).slice(0, 60) : Math.max(0, Number(item.value) || 0) }))
  return { windowDays, conditions }
}

/** Quantas sessões com clique de compra, nos últimos `windowDays`, atendem às regras. Só conta quem permitiu medição. */
export async function segmentReach(match: 'all' | 'any', rules: SegmentRules) {
  const checks: SQL[] = rules.conditions.map((condition) => {
    switch (condition.type) {
      case 'min_clicks': return sql`count(*) >= ${Number(condition.value)}`
      case 'category': return sql`bool_or(cat.slug = ${String(condition.value)})`
      case 'min_price': return sql`bool_or(o.price >= ${Number(condition.value)})`
      case 'max_price': return sql`bool_or(o.price <= ${Number(condition.value)})`
      case 'slot': return sql`bool_or(c.recommendation_slot_id = ${String(condition.value)})`
    }
  })
  const having = checks.length ? sql.join(checks, match === 'any' ? sql` or ` : sql` and `) : sql`true`
  const result = await db.execute(sql`
    select count(*)::int as n from (
      select c.session_id
      from affiliate_clicks c
      join offers o on o.id = c.offer_id
      left join product_categories pc on pc.product_id = o.product_id and pc.is_primary
      left join categories cat on cat.id = pc.category_id
      where c.created_at > now() - make_interval(days => ${rules.windowDays})
      group by c.session_id
      having ${having}
    ) matched`)
  return Number((result.rows[0] as { n: number } | undefined)?.n ?? 0)
}

const segmentsHandler: Handler = {
  async list(params) {
    const like = likeOf(params.q)
    const rows = await db.select().from(segments).where(like ? ilike(segments.name, like) : undefined).orderBy(desc(segments.updatedAt))
    const withReach = await Promise.all(rows.map(async (row) => {
      const rules = parseSegmentRules(row.rules)
      const reach = await segmentReach(row.match === 'any' ? 'any' : 'all', rules)
      return { ...row, rules, reach: `${reach.toLocaleString('pt-BR')} sessões` }
    }))
    return { rows: withReach, total: withReach.length }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select().from(segments).where(eq(segments.id, id))
    if (!row) return null
    return { ...row, rules: parseSegmentRules(row.rules) }
  },
  async create(values) {
    const [created] = await db.insert(segments).values({
      name: String(values.name), description: (values.description as string | null) ?? null,
      match: values.match === 'any' ? 'any' : 'all', rules: parseSegmentRules(values.rules),
    }).returning()
    return { row: { ...created, rules: parseSegmentRules(created.rules) } }
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const patch: Partial<typeof segments.$inferInsert> = { updatedAt: nowIso() }
    if ('name' in values) patch.name = String(values.name)
    if ('description' in values) patch.description = (values.description as string | null) ?? null
    if ('match' in values) patch.match = values.match === 'any' ? 'any' : 'all'
    if ('rules' in values) patch.rules = parseSegmentRules(values.rules)
    const [updated] = await db.update(segments).set(patch).where(eq(segments.id, id)).returning()
    return updated ? { row: { ...updated, rules: parseSegmentRules(updated.rules) } } : null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(segments).where(eq(segments.id, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- recursos (feature flags)
// A chave da flag é a chave primária; `id` aqui é a própria chave.
const flagRow = (row: typeof featureFlags.$inferSelect): AdminRow => ({ ...row, id: row.key, wired: wiredFlags[row.key] ?? 'Nenhum: o código ainda não consulta esta chave.' })

const flagsHandler: Handler = {
  revalidate: ['catalog'],
  async list(params) {
    const like = likeOf(params.q)
    const rows = await db.select().from(featureFlags).where(like ? or(ilike(featureFlags.key, like), ilike(featureFlags.description, like)) : undefined).orderBy(asc(featureFlags.key))
    return { rows: rows.map(flagRow), total: rows.length }
  },
  async get(id) {
    const [row] = await db.select().from(featureFlags).where(eq(featureFlags.key, id))
    return row ? flagRow(row) : null
  },
  async create(values) {
    const key = String(values.key)
    const [clash] = await db.select({ key: featureFlags.key }).from(featureFlags).where(eq(featureFlags.key, key))
    if (clash) return { errors: { key: 'Já existe um recurso com essa chave.' }, status: 409 }
    const [created] = await db.insert(featureFlags).values({
      key, description: (values.description as string | null) ?? null, enabled: Boolean(values.enabled),
    }).returning()
    return { row: flagRow(created) }
  },
  async update(id, values) {
    const patch: Partial<typeof featureFlags.$inferInsert> = { updatedAt: nowIso() }
    if ('description' in values) patch.description = (values.description as string | null) ?? null
    if ('enabled' in values) patch.enabled = Boolean(values.enabled)
    const [updated] = await db.update(featureFlags).set(patch).where(eq(featureFlags.key, id)).returning()
    return updated ? { row: flagRow(updated) } : null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(featureFlags).where(eq(featureFlags.key, id))
    return { ok: true, before }
  },
}

// ---------------------------------------------------------------- usuários e papéis
const adminRoleCodes = ['OWNER', 'ADMIN'] as const

const usersHandler: Handler = {
  async list(params) {
    const like = likeOf(params.q)
    const where = like ? or(ilike(users.email, like), ilike(users.name, like)) : undefined
    const [rows, count] = await Promise.all([
      db.select({
        id: users.id, name: users.name, email: users.email, createdAt: users.createdAt,
        roles: sql<string | null>`(select string_agg(r.code::text, ', ' order by r.code) from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = ${users.id})`,
      }).from(users).where(where).orderBy(desc(users.createdAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(users).where(where)),
    ])
    return { rows: rows.map((row) => ({ ...row, name: row.name ?? '—', roles: row.roles ?? 'Sem papel' })), total: count }
  },
  async get(id) {
    if (!isUuid(id)) return null
    const [row] = await db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }).from(users).where(eq(users.id, id))
    if (!row) return null
    const granted = await db.select({ id: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id))
    return { ...row, name: row.name ?? '—', roleIds: granted.map((item) => item.id).sort() }
  },
  async update(id, values, actorId) {
    const before = await this.get(id)
    if (!before) return null
    const wanted = await db.select({ id: roles.id, code: roles.code }).from(roles).where(inArray(roles.id, (values.roleIds as string[] | undefined) ?? []))
    // Evita se trancar para fora: quem edita a si mesmo não pode ficar sem papel de administração.
    if (id === actorId && !wanted.some((role) => (adminRoleCodes as readonly string[]).includes(role.code))) {
      return { errors: { roleIds: 'Você não pode tirar o seu próprio acesso de administração. Peça a outra pessoa.' }, status: 409 }
    }
    // Sempre sobra pelo menos um proprietário/administrador.
    const stillAdmin = wanted.some((role) => (adminRoleCodes as readonly string[]).includes(role.code))
    if (!stillAdmin) {
      const result = await db.execute(sql`
        select count(distinct ur.user_id)::int as n from user_roles ur join roles r on r.id = ur.role_id
        where r.code in ('OWNER','ADMIN') and ur.user_id <> ${id}`)
      if (Number((result.rows[0] as { n: number }).n) === 0) return { errors: { roleIds: 'É preciso manter ao menos um proprietário ou administrador.' }, status: 409 }
    }
    await db.delete(userRoles).where(eq(userRoles.userId, id))
    if (wanted.length) await db.insert(userRoles).values(wanted.map((role) => ({ userId: id, roleId: role.id })))
    return { row: (await this.get(id))! }
  },
}

// ---------------------------------------------------------------- LGPD
const privacyTypeLabels: Record<string, string> = privacyRequestLabels
const privacySourceLabels: Record<string, string> = { portal: 'Formulário público', account: 'Minha conta' }

const privacyHandler: Handler = {
  async list(params) {
    const like = likeOf(params.q)
    const status = (['pending', 'processing', 'completed', 'rejected'] as const).find((value) => value === params.filter)
    const holder = sql<string>`coalesce(${users.email}, ${privacyRequests.email})`
    const where = and(like ? ilike(holder, like) : undefined, status ? eq(privacyRequests.status, status) : undefined)
    const [rows, count] = await Promise.all([
      db.select({
        id: privacyRequests.id, email: holder, type: privacyRequests.type, status: privacyRequests.status,
        message: privacyRequests.message, source: privacyRequests.source, responseNote: privacyRequests.responseNote,
        requestedAt: privacyRequests.requestedAt, completedAt: privacyRequests.completedAt,
      }).from(privacyRequests).leftJoin(users, eq(users.id, privacyRequests.userId)).where(where)
        .orderBy(desc(privacyRequests.requestedAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(privacyRequests).leftJoin(users, eq(users.id, privacyRequests.userId)).where(where)),
    ])
    return {
      total: count,
      rows: rows.map((row) => ({
        id: row.id, email: row.email ?? '—', type: privacyTypeLabels[row.type] ?? row.type, status: row.status,
        protocol: row.id.slice(0, 8).toUpperCase(),
        excerpt: row.message ? (row.message.length > 90 ? `${row.message.slice(0, 90)}…` : row.message) : '—',
        message: row.message ?? '', source: privacySourceLabels[row.source ?? ''] ?? '—', responseNote: row.responseNote ?? '',
        requestedAt: row.requestedAt, completedAt: row.completedAt,
      })),
    }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 500, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
  async update(id, values) {
    if (!isUuid(id)) return null
    const patch: Partial<typeof privacyRequests.$inferInsert> = {}
    if ('status' in values) {
      const status = values.status as typeof privacyRequests.$inferInsert.status
      patch.status = status
      patch.completedAt = status === 'completed' || status === 'rejected' ? nowIso() : null
    }
    if ('responseNote' in values) patch.responseNote = String(values.responseNote ?? '').slice(0, 1000) || null
    if (!Object.keys(patch).length) return { row: (await this.get(id))! }
    const [updated] = await db.update(privacyRequests).set(patch).where(eq(privacyRequests.id, id)).returning({ id: privacyRequests.id })
    return updated ? { row: (await this.get(id))! } : null
  },
}

// ---------------------------------------------------------------- auditoria
const auditHandler: Handler = {
  async list(params) {
    const like = likeOf(params.q)
    const where = like ? or(ilike(auditLogs.action, like), ilike(auditLogs.entityType, like), ilike(auditLogs.entityId, like), ilike(users.email, like)) : undefined
    const [rows, count] = await Promise.all([
      db.select({
        id: auditLogs.id, createdAt: auditLogs.createdAt, actor: users.email, action: auditLogs.action,
        entityType: auditLogs.entityType, entityId: auditLogs.entityId, before: auditLogs.before, after: auditLogs.after,
      }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(where).orderBy(desc(auditLogs.createdAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(where)),
    ])
    return {
      total: count,
      rows: rows.map((row) => ({ ...row, actor: row.actor ?? 'Sistema', entity: `${row.entityType} · ${row.entityId.slice(0, 36)}` })),
    }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 1, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
}

// ---------------------------------------------------------------- sessões
const sessionsHandler: Handler = {
  async list(params) {
    const like = likeOf(params.q)
    const where = and(sql`${sessions.expiresAt} > now()`, like ? or(ilike(users.email, like), ilike(users.name, like)) : undefined)
    const [rows, count] = await Promise.all([
      db.select({
        id: sessions.id, name: users.name, email: users.email, ip: sessions.ipAddress, userAgent: sessions.userAgent,
        createdAt: sessions.createdAt, expiresAt: sessions.expiresAt,
      }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(where).orderBy(desc(sessions.createdAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(where)),
    ])
    return {
      total: count,
      rows: rows.map((row) => ({
        id: row.id, who: row.name ? `${row.name} (${row.email})` : row.email, ip: row.ip ?? '—',
        device: summarizeAgent(row.userAgent), createdAt: row.createdAt, expiresAt: row.expiresAt,
      })),
    }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 1000, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
  async remove(id) {
    const before = await this.get(id)
    if (!before) return null
    await db.delete(sessions).where(eq(sessions.id, id))
    return { ok: true, before }
  },
}

function summarizeAgent(agent: string | null) {
  if (!agent) return '—'
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Navegador'
  const system = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /iPhone|iPad|iOS/.test(agent) ? 'iOS' : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : ''
  return system ? `${browser} · ${system}` : browser
}

// ---------------------------------------------------------------- importações
const duration = (start: string, end: string | null) => {
  if (!end) return 'em andamento'
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
const runStatus: Record<string, string> = { running: 'Em andamento', succeeded: 'Concluída', failed: 'Falhou', partial: 'Parcial' }

const importsHandler: Handler = {
  async list(params) {
    const [rows, count] = await Promise.all([
      db.select({
        id: syncJobRuns.id, jobType: syncJobs.jobType, startedAt: syncJobRuns.startedAt, finishedAt: syncJobRuns.finishedAt, status: syncJobRuns.status,
        processed: syncJobRuns.processedCount, created: syncJobRuns.createdCount, updated: syncJobRuns.updatedCount, rejected: syncJobRuns.rejectedCount,
        error: sql<string | null>`(select e.error_message from sync_errors e where e.sync_job_run_id = ${syncJobRuns.id} order by e.created_at desc limit 1)`,
      }).from(syncJobRuns).innerJoin(syncJobs, eq(syncJobs.id, syncJobRuns.syncJobId)).orderBy(desc(syncJobRuns.startedAt)).limit(page(params).limit).offset(page(params).offset),
      total(db.select({ n: sql<number>`count(*)::int` }).from(syncJobRuns)),
    ])
    return {
      total: count,
      rows: rows.map((row) => ({
        id: row.id, startedAt: row.startedAt, kind: row.jobType === 'conversion_sync' ? 'Comissões' : 'Catálogo',
        duration: duration(row.startedAt, row.finishedAt), status: runStatus[row.status] ?? row.status,
        processed: row.processed, created: row.created, updated: row.updated, rejected: row.rejected, error: row.error ?? '—',
      })),
    }
  },
  async get(id) {
    if (!isUuid(id)) return null
    return (await this.list({ q: '', page: 1, pageSize: 500, filter: '' })).rows.find((row) => row.id === id) ?? null
  },
}

export const handlers: Record<ResourceSlug, Handler> = {
  produtos: productsHandler,
  ofertas: offersHandler,
  providers: providersHandler,
  categorias: categoriesHandler,
  marcas: brandsHandler,
  tags: tagsHandler,
  colecoes: collectionsHandler,
  campanhas: campaignsHandler,
  cms: contentHandler('article'),
  paginas: contentHandler('page'),
  cupons: couponsHandler,
  segmentos: segmentsHandler,
  flags: flagsHandler,
  usuarios: usersHandler,
  lgpd: privacyHandler,
  'audit-log': auditHandler,
  sessoes: sessionsHandler,
  importacoes: importsHandler,
}

export { resources }
