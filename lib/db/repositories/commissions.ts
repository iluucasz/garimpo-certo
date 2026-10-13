import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { affiliateConversionItems, affiliateConversions, offers, products, syncJobRuns, syncJobs } from '../schema'

export type CommissionBucket = { count: number; amount: number; commission: number }
export type CommissionReport = {
  windowDays: number
  lastSync: { at: string | null; status: string | null; error: string | null }
  totals: { conversions: number; pending: CommissionBucket; approved: CommissionBucket; paid: CommissionBucket; lost: CommissionBucket }
  byOrigin: { channel: string; detail: string | null; conversions: number; amount: number; commission: number }[]
  byProduct: { productId: string; name: string; slug: string; conversions: number; quantity: number; amount: number; commission: number }[]
}

const empty = (): CommissionBucket => ({ count: 0, amount: 0, commission: 0 })
const money = (value: unknown) => Math.round(Number(value) * 100) / 100 || 0

/**
 * Comissões reais por situação, origem (canal e categoria/campanha) e produto, na janela pedida.
 * Tudo vem de `affiliate_conversions`/`affiliate_conversion_items`, que o importador preenche com o relatório da Shopee.
 * "Perdida" = cancelada ou rejeitada; não entra em origem nem em produto.
 */
export async function getCommissionReport(windowDays = 30): Promise<CommissionReport> {
  const days = Math.min(Math.max(Math.trunc(windowDays) || 30, 1), 365)
  const when = sql`coalesce(${affiliateConversions.convertedAt}, ${affiliateConversions.syncedAt})`
  const inWindow = sql`${when} > now() - (${days} * interval '1 day')`
  const valid = sql`${affiliateConversions.status} in ('pending', 'approved', 'paid')`

  const [statusRows, originRows, productRows, runRows] = await Promise.all([
    db.select({
      status: affiliateConversions.status,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${affiliateConversions.amount}), 0)`,
      commission: sql<string>`coalesce(sum(${affiliateConversions.commission}), 0)`,
    }).from(affiliateConversions).where(inWindow).groupBy(affiliateConversions.status),

    db.select({
      channel: sql<string>`coalesce(nullif(split_part(${affiliateConversions.subIds}, '-', 1), ''), 'sem-origem')`,
      detail: sql<string | null>`nullif(split_part(${affiliateConversions.subIds}, '-', 2), '')`,
      conversions: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${affiliateConversions.amount}), 0)`,
      commission: sql<string>`coalesce(sum(${affiliateConversions.commission}), 0)`,
    }).from(affiliateConversions).where(sql`${inWindow} and ${valid}`)
      .groupBy(sql`1`, sql`2`).orderBy(desc(sql`sum(${affiliateConversions.commission})`)).limit(30),

    db.select({
      productId: products.id, name: products.name, slug: products.slug,
      conversions: sql<number>`count(distinct ${affiliateConversionItems.conversionId})::int`,
      quantity: sql<number>`coalesce(sum(${affiliateConversionItems.quantity}), 0)::int`,
      amount: sql<string>`coalesce(sum(${affiliateConversionItems.amount}), 0)`,
      commission: sql<string>`coalesce(sum(${affiliateConversionItems.commission}), 0)`,
    }).from(affiliateConversionItems)
      .innerJoin(affiliateConversions, eq(affiliateConversions.id, affiliateConversionItems.conversionId))
      .innerJoin(offers, eq(offers.id, affiliateConversionItems.offerId))
      .innerJoin(products, eq(products.id, offers.productId))
      .where(sql`${inWindow} and ${valid}`)
      .groupBy(products.id, products.name, products.slug)
      .orderBy(desc(sql`sum(${affiliateConversionItems.commission})`)).limit(10),

    db.select({ startedAt: syncJobRuns.startedAt, finishedAt: syncJobRuns.finishedAt, status: syncJobRuns.status,
      error: sql<string | null>`(select e.error_message from sync_errors e where e.sync_job_run_id = ${syncJobRuns.id} order by e.created_at desc limit 1)` })
      .from(syncJobRuns).innerJoin(syncJobs, eq(syncJobs.id, syncJobRuns.syncJobId))
      .where(eq(syncJobs.jobType, 'conversion_sync')).orderBy(desc(syncJobRuns.startedAt)).limit(1),
  ])

  const totals: CommissionReport['totals'] = { conversions: 0, pending: empty(), approved: empty(), paid: empty(), lost: empty() }
  for (const row of statusRows) {
    totals.conversions += row.count
    const bucket = row.status === 'pending' ? totals.pending : row.status === 'approved' ? totals.approved : row.status === 'paid' ? totals.paid : totals.lost
    bucket.count += row.count
    bucket.amount = money(bucket.amount + Number(row.amount))
    bucket.commission = money(bucket.commission + Number(row.commission))
  }

  const run = runRows[0]
  return {
    windowDays: days,
    lastSync: { at: run ? (run.finishedAt ?? run.startedAt) : null, status: run?.status ?? null, error: run?.error ?? null },
    totals,
    byOrigin: originRows.map((row) => ({ channel: row.channel, detail: row.detail, conversions: row.conversions, amount: money(row.amount), commission: money(row.commission) })),
    byProduct: productRows.map((row) => ({ ...row, amount: money(row.amount), commission: money(row.commission) })),
  }
}
