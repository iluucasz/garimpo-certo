import { desc, sql } from 'drizzle-orm'
import { db } from '../client'
import { analyticsEvents, coupons } from '../schema'

const TIMEZONE = 'America/Sao_Paulo'

export type CouponClickStats = { clicks7d: number; clicks30d: number; sessions30d: number; lastClickAt: string | null }
export type CouponClickReport = {
  totals: { today: number; last7d: number; last30d: number; sessions30d: number }
  byDay: { day: string; count: number }[]
  top: { couponId: string; title: string; code: string | null; source: string; isActive: boolean; clicks7d: number; clicks30d: number; sessions30d: number; lastClickAt: string | null }[]
  neverClicked: number
}

const couponId = sql<string>`${analyticsEvents.metadata}->>'couponId'`
const isCouponClick = sql`${analyticsEvents.eventName} = 'coupon_click' and ${analyticsEvents.metadata}->>'couponId' is not null`

/** Cliques medidos por cupom (só de visitantes que permitiram a medição). */
export async function getCouponClickStats(): Promise<Map<string, CouponClickStats>> {
  const rows = await db.select({
    couponId,
    clicks7d: sql<number>`count(*) filter (where ${analyticsEvents.timestamp} > now() - interval '7 days')::int`,
    clicks30d: sql<number>`count(*) filter (where ${analyticsEvents.timestamp} > now() - interval '30 days')::int`,
    sessions30d: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.timestamp} > now() - interval '30 days')::int`,
    lastClickAt: sql<string | null>`max(${analyticsEvents.timestamp})`,
  }).from(analyticsEvents).where(isCouponClick).groupBy(couponId)
  return new Map(rows.map((row) => [row.couponId, {
    clicks7d: row.clicks7d, clicks30d: row.clicks30d, sessions30d: row.sessions30d,
    lastClickAt: row.lastClickAt ? new Date(row.lastClickAt).toISOString() : null,
  }]))
}

/** Resumo para o painel de cupons: totais, 14 dias corridos e os cupons mais clicados. */
export async function getCouponClickReport(): Promise<CouponClickReport> {
  const day = sql<string>`to_char(${analyticsEvents.timestamp} at time zone ${sql.raw(`'${TIMEZONE}'`)}, 'YYYY-MM-DD')`
  const [totalRows, dayRows, stats, couponRows] = await Promise.all([
    db.select({
      today: sql<number>`count(*) filter (where ${analyticsEvents.timestamp} > date_trunc('day', now() at time zone ${sql.raw(`'${TIMEZONE}'`)}) at time zone ${sql.raw(`'${TIMEZONE}'`)})::int`,
      last7d: sql<number>`count(*) filter (where ${analyticsEvents.timestamp} > now() - interval '7 days')::int`,
      last30d: sql<number>`count(*) filter (where ${analyticsEvents.timestamp} > now() - interval '30 days')::int`,
      sessions30d: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.timestamp} > now() - interval '30 days')::int`,
    }).from(analyticsEvents).where(isCouponClick),
    db.select({ day, count: sql<number>`count(*)::int` }).from(analyticsEvents)
      .where(sql`${isCouponClick} and ${analyticsEvents.timestamp} > now() - interval '15 days'`).groupBy(day),
    getCouponClickStats(),
    db.select({ id: coupons.id, title: coupons.title, code: coupons.code, source: coupons.source, isActive: coupons.isActive })
      .from(coupons).orderBy(desc(coupons.isActive), desc(coupons.createdAt)),
  ])

  const counts = new Map(dayRows.map((row) => [row.day, row.count]))
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  const byDay: { day: string; count: number }[] = []
  for (let offset = 13; offset >= 0; offset--) {
    const key = fmt.format(new Date(Date.now() - offset * 86_400_000))
    byDay.push({ day: key, count: counts.get(key) ?? 0 })
  }

  const all = couponRows.map((coupon) => ({
    couponId: coupon.id, title: coupon.title, code: coupon.code, source: coupon.source, isActive: coupon.isActive,
    clicks7d: stats.get(coupon.id)?.clicks7d ?? 0, clicks30d: stats.get(coupon.id)?.clicks30d ?? 0,
    sessions30d: stats.get(coupon.id)?.sessions30d ?? 0, lastClickAt: stats.get(coupon.id)?.lastClickAt ?? null,
  }))
  const visible = all.filter((row) => row.isActive)
  return {
    totals: totalRows[0] ?? { today: 0, last7d: 0, last30d: 0, sessions30d: 0 },
    byDay,
    top: [...all].sort((a, b) => b.clicks30d - a.clicks30d || b.clicks7d - a.clicks7d).filter((row) => row.clicks30d > 0).slice(0, 10),
    // Cupom no ar sem nenhum clique medido em 30 dias: candidato a sair ou a ganhar destaque.
    neverClicked: visible.filter((row) => row.clicks30d === 0).length,
  }
}
