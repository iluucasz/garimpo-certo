import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { affiliateClicks, affiliateConversions, brands, offers, products, users, wishlistItems } from '../schema'

const TIMEZONE = 'America/Sao_Paulo'

export type AdminOverview = {
  catalog: { active: number; archived: number; offers: number; syncedAt: string | null }
  clicks: { total: number; last7d: number; byDay: { day: string; count: number }[] }
  conversions: { total: number; pending: number; approved: number; commissionPending: number; commissionApproved: number }
  audience: { users: number; favorites: number }
  topProducts: { id: string; name: string; slug: string; brand: string; soldCount: number; price: number; rating: number }[]
}

/** Últimos 7 dias, do mais antigo ao de hoje, preenchendo com zero os dias sem clique. */
function lastSevenDays(rows: { day: string; n: number }[]) {
  const counts = new Map(rows.map((row) => [row.day, row.n]))
  const days: { day: string; count: number }[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86_400_000)
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    days.push({ day: key, count: counts.get(key) ?? 0 })
  }
  return days
}

/** Números do painel: tudo sai do banco, nada é estimado nem de exemplo. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const day = sql<string>`to_char(${affiliateClicks.createdAt} at time zone ${sql.raw(`'${TIMEZONE}'`)}, 'YYYY-MM-DD')`

  const [productCounts, offerStats, clickTotals, clickDays, conversionRows, userCount, favoriteCount, top] = await Promise.all([
    db.select({
      active: sql<number>`count(*) filter (where ${products.status} = 'active')::int`,
      archived: sql<number>`count(*) filter (where ${products.status} <> 'active')::int`,
    }).from(products),
    db.select({
      total: sql<number>`count(*)::int`,
      syncedAt: sql<string | null>`max(${offers.lastSyncedAt})`,
    }).from(offers).where(eq(offers.status, 'active')),
    db.select({
      total: sql<number>`count(*)::int`,
      last7d: sql<number>`count(*) filter (where ${affiliateClicks.createdAt} > now() - interval '7 days')::int`,
    }).from(affiliateClicks),
    db.select({ day, n: sql<number>`count(*)::int` }).from(affiliateClicks)
      .where(sql`${affiliateClicks.createdAt} > now() - interval '8 days'`).groupBy(day),
    db.select({
      status: affiliateConversions.status,
      n: sql<number>`count(*)::int`,
      commission: sql<string>`coalesce(sum(${affiliateConversions.commission}), 0)`,
    }).from(affiliateConversions).groupBy(affiliateConversions.status),
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(wishlistItems),
    db.select({
      id: products.id, name: products.name, slug: products.slug, brand: brands.name,
      soldCount: offers.soldCount, price: offers.price, rating: products.rating,
    }).from(products)
      .innerJoin(offers, eq(offers.productId, products.id))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(sql`${products.status} = 'active' and ${offers.status} = 'active'`)
      .orderBy(sql`${offers.soldCount} desc nulls last`).limit(5),
  ])

  const conversionTotals = conversionRows.reduce((acc, row) => {
    acc.total += row.n
    if (row.status === 'pending') { acc.pending += row.n; acc.commissionPending += Number(row.commission) }
    if (row.status === 'approved' || row.status === 'paid') { acc.approved += row.n; acc.commissionApproved += Number(row.commission) }
    return acc
  }, { total: 0, pending: 0, approved: 0, commissionPending: 0, commissionApproved: 0 })

  return {
    catalog: {
      active: productCounts[0]?.active ?? 0,
      archived: productCounts[0]?.archived ?? 0,
      offers: offerStats[0]?.total ?? 0,
      syncedAt: offerStats[0]?.syncedAt ? new Date(offerStats[0].syncedAt).toISOString() : null,
    },
    clicks: { total: clickTotals[0]?.total ?? 0, last7d: clickTotals[0]?.last7d ?? 0, byDay: lastSevenDays(clickDays) },
    conversions: conversionTotals,
    audience: { users: userCount[0]?.n ?? 0, favorites: favoriteCount[0]?.n ?? 0 },
    topProducts: top.map((row) => ({
      id: row.id, name: row.name, slug: row.slug, brand: row.brand ?? 'Genérico',
      soldCount: row.soldCount ?? 0, price: Number(row.price), rating: Number(row.rating),
    })),
  }
}

/** Todos os produtos (inclusive arquivados) com a melhor oferta, para a tela de catálogo do painel. */
export async function listCatalogForAdmin() {
  const rows = await db.select({
    id: products.id, name: products.name, slug: products.slug, status: products.status, rating: products.rating,
    score: products.editorialScore, brand: brands.name, price: offers.price, previousPrice: offers.originalPrice,
    soldCount: offers.soldCount, syncedAt: offers.lastSyncedAt, offerStatus: offers.status, externalUrl: offers.affiliateUrl,
  }).from(products)
    .leftJoin(offers, eq(offers.productId, products.id))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .orderBy(sql`${products.status} = 'active' desc`, sql`${offers.soldCount} desc nulls last`)
  return rows.map((row) => ({
    id: row.id, name: row.name, slug: row.slug, active: row.status === 'active', brand: row.brand ?? 'Genérico',
    rating: Number(row.rating), score: Number(row.score), price: row.price ? Number(row.price) : null,
    previousPrice: row.previousPrice ? Number(row.previousPrice) : null, soldCount: row.soldCount ?? 0,
    syncedAt: row.syncedAt ? new Date(row.syncedAt).toISOString() : null, hasAffiliateLink: Boolean(row.externalUrl),
  }))
}
