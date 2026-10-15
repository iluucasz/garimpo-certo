import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { getCommissionReport } from '@/lib/db/repositories/commissions'
import { loadCategoryStats } from './store'

/**
 * Resumo da semana para o dono: o que o público fez nos últimos 7 dias contra os 7 anteriores, o que mais clicou,
 * o que a Engine mudou e quanto rendeu. Só leitura, só número medido (visitantes que permitiram a medição de uso).
 */

export type Pair = { current: number; previous: number }

export type WeeklyDigest = {
  generatedAt: string
  days: number
  /** Há alguma medição de visitantes no período? Sem ela, os números do site ficam zerados e o painel explica por quê. */
  measured: boolean
  site: { clicks: Pair; views: Pair; favorites: Pair; sessions: Pair }
  topProducts: { id: string; name: string; slug: string; category: string | null; clicks: number }[]
  topCategories: { slug: string; name: string; clicks: number; previous: number }[]
  catalog: { added: number; removed: number; total: number }
  engine: { created: number; applied: number; rejected: number; pending: number }
  posts: { sent: number; failed: number; cancelled: number }
  commissions: { conversions: number; pending: number; confirmed: number; lost: number; byChannel: { channel: string; commission: number; conversions: number }[] }
}

const DAYS = 7

/** Variação em % entre dois períodos; `null` quando não há base de comparação. */
export function changePercent(pair: Pair): number | null {
  if (pair.previous <= 0) return null
  return Math.round(((pair.current - pair.previous) / pair.previous) * 100)
}

const pair = (row: Record<string, unknown> | undefined, key: string): Pair => ({
  current: Number(row?.[`${key}_cur`] ?? 0), previous: Number(row?.[`${key}_prev`] ?? 0),
})

export async function getWeeklyDigest(now = Date.now()): Promise<WeeklyDigest> {
  const [clicks, events, top, catalog, proposals, posts, commissions, catNow, catTwo] = await Promise.all([
    db.execute(sql`
      select count(*) filter (where created_at > now() - interval '7 days')::int as c_cur,
             count(*) filter (where created_at <= now() - interval '7 days')::int as c_prev
      from affiliate_clicks where created_at > now() - interval '14 days'`),
    db.execute(sql`
      select
        count(*) filter (where event_name in ('product_view', 'page_view') and "timestamp" > now() - interval '7 days')::int as v_cur,
        count(*) filter (where event_name in ('product_view', 'page_view') and "timestamp" <= now() - interval '7 days')::int as v_prev,
        count(*) filter (where event_name = 'favorite_added' and "timestamp" > now() - interval '7 days')::int as f_cur,
        count(*) filter (where event_name = 'favorite_added' and "timestamp" <= now() - interval '7 days')::int as f_prev,
        count(distinct session_id) filter (where "timestamp" > now() - interval '7 days')::int as s_cur,
        count(distinct session_id) filter (where "timestamp" <= now() - interval '7 days')::int as s_prev
      from analytics_events where "timestamp" > now() - interval '14 days'`),
    db.execute(sql`
      select p.id, p.name, p.slug, count(*)::int as clicks,
             (select c.name from product_categories pc join categories c on c.id = pc.category_id
              where pc.product_id = p.id order by pc.is_primary desc limit 1) as category
      from affiliate_clicks ac join offers o on o.id = ac.offer_id join products p on p.id = o.product_id
      where ac.created_at > now() - interval '7 days' and p.status = 'active'
      group by p.id, p.name, p.slug order by clicks desc, p.name limit 5`),
    db.execute(sql`
      select count(*) filter (where status = 'active' and created_at > now() - interval '7 days')::int as added,
             count(*) filter (where status = 'removed' and updated_at > now() - interval '7 days')::int as removed,
             count(*) filter (where status = 'active')::int as total
      from products`),
    db.execute(sql`
      select count(*) filter (where created_at > now() - interval '7 days')::int as created,
             count(*) filter (where status = 'applied' and decided_at > now() - interval '7 days')::int as applied,
             count(*) filter (where status = 'rejected' and decided_at > now() - interval '7 days')::int as rejected,
             count(*) filter (where status = 'pending')::int as pending
      from engine_proposals`),
    db.execute(sql`
      select count(*) filter (where status = 'sent' and sent_at > now() - interval '7 days')::int as sent,
             count(*) filter (where status = 'failed' and updated_at > now() - interval '7 days')::int as failed,
             count(*) filter (where status = 'cancelled' and updated_at > now() - interval '7 days')::int as cancelled
      from social_posts where channel = 'telegram'`),
    getCommissionReport(DAYS).catch(() => null),
    loadCategoryStats(7).catch(() => []),
    loadCategoryStats(14).catch(() => []),
  ])

  const e = events.rows[0] as Record<string, unknown> | undefined
  const c = clicks.rows[0] as Record<string, unknown> | undefined
  const site = {
    clicks: { current: Number(c?.c_cur ?? 0), previous: Number(c?.c_prev ?? 0) },
    views: pair(e, 'v'), favorites: pair(e, 'f'), sessions: pair(e, 's'),
  }

  const twoWeeks = new Map(catTwo.map((item) => [item.slug, item.clicks]))
  const topCategories = catNow
    .map((item) => ({ slug: item.slug, name: item.name, clicks: item.clicks, previous: Math.max(0, (twoWeeks.get(item.slug) ?? 0) - item.clicks) }))
    .filter((item) => item.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5)

  const cat = (catalog.rows[0] ?? {}) as Record<string, unknown>
  const prop = (proposals.rows[0] ?? {}) as Record<string, unknown>
  const post = (posts.rows[0] ?? {}) as Record<string, unknown>

  const byChannel = new Map<string, { commission: number; conversions: number }>()
  for (const row of commissions?.byOrigin ?? []) {
    const current = byChannel.get(row.channel) ?? { commission: 0, conversions: 0 }
    current.commission += row.commission
    current.conversions += row.conversions
    byChannel.set(row.channel, current)
  }

  return {
    generatedAt: new Date(now).toISOString(),
    days: DAYS,
    measured: site.sessions.current + site.sessions.previous + site.clicks.current + site.clicks.previous > 0,
    site,
    topProducts: (top.rows as { id: string; name: string; slug: string; category: string | null; clicks: number }[]).map((row) => ({ ...row, clicks: Number(row.clicks) })),
    topCategories,
    catalog: { added: Number(cat.added ?? 0), removed: Number(cat.removed ?? 0), total: Number(cat.total ?? 0) },
    engine: { created: Number(prop.created ?? 0), applied: Number(prop.applied ?? 0), rejected: Number(prop.rejected ?? 0), pending: Number(prop.pending ?? 0) },
    posts: { sent: Number(post.sent ?? 0), failed: Number(post.failed ?? 0), cancelled: Number(post.cancelled ?? 0) },
    commissions: {
      conversions: commissions?.totals.conversions ?? 0,
      pending: commissions?.totals.pending.commission ?? 0,
      confirmed: (commissions?.totals.approved.commission ?? 0) + (commissions?.totals.paid.commission ?? 0),
      lost: commissions?.totals.lost.commission ?? 0,
      byChannel: [...byChannel.entries()].map(([channel, value]) => ({ channel, ...value })).sort((a, b) => b.commission - a.commission),
    },
  }
}
