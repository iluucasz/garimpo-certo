import { sql } from 'drizzle-orm'
import { db } from '../client'
import { affiliateClicks, affiliateConversions, analyticsEvents, offers } from '../schema'

import type { ProductMetrics } from '@/lib/types'

export type ProductMetricsMap = Record<string, ProductMetrics>

const empty: ProductMetrics = { views: 0, clicks: 0, favorites: 0, conversions: 0, views24h: 0, views7d: 0, clicks7d: 0 }

/**
 * Agrega os eventos brutos por produto. Tudo sai de `analytics_events`,
 * `affiliate_clicks` e `affiliate_conversions` — nenhum número é estimado aqui.
 */
export async function getProductMetrics(): Promise<ProductMetricsMap> {
  const [eventRows, clickRows, conversionRows] = await Promise.all([
    db.select({
      productId: analyticsEvents.productId,
      views: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('product_view', 'page_view'))::int`,
      favorites: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('favorite_add', 'product_favorite'))::int`,
      views24h: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('product_view', 'page_view') and ${analyticsEvents.timestamp} > now() - interval '24 hours')::int`,
      views7d: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('product_view', 'page_view') and ${analyticsEvents.timestamp} > now() - interval '7 days')::int`,
    }).from(analyticsEvents).where(sql`${analyticsEvents.productId} is not null`).groupBy(analyticsEvents.productId),

    db.select({
      productId: offers.productId,
      clicks: sql<number>`count(*)::int`,
      clicks7d: sql<number>`count(*) filter (where ${affiliateClicks.createdAt} > now() - interval '7 days')::int`,
    }).from(affiliateClicks).innerJoin(offers, sql`${offers.id} = ${affiliateClicks.offerId}`).groupBy(offers.productId),

    db.select({
      productId: offers.productId,
      conversions: sql<number>`count(*)::int`,
    }).from(affiliateConversions)
      .innerJoin(affiliateClicks, sql`${affiliateClicks.clickId} = ${affiliateConversions.clickId}`)
      .innerJoin(offers, sql`${offers.id} = ${affiliateClicks.offerId}`)
      .groupBy(offers.productId),
  ])

  const metrics: ProductMetricsMap = {}
  const forProduct = (productId: string | null) => {
    if (!productId) return null
    metrics[productId] ??= { ...empty }
    return metrics[productId]
  }
  for (const row of eventRows) {
    const entry = forProduct(row.productId)
    if (entry) Object.assign(entry, { views: row.views, favorites: row.favorites, views24h: row.views24h, views7d: row.views7d })
  }
  for (const row of clickRows) {
    const entry = forProduct(row.productId)
    if (entry) Object.assign(entry, { clicks: row.clicks, clicks7d: row.clicks7d })
  }
  for (const row of conversionRows) {
    const entry = forProduct(row.productId)
    if (entry) entry.conversions = row.conversions
  }
  return metrics
}
