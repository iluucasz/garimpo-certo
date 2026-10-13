import { sql } from 'drizzle-orm'
import { recordAudit } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { authorize, fail, ok } from '@/lib/server/api'
import { getSetting } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** Nome efetivo do evento: os da vitrine chegam como `ProductUpdated`/`FavoriteAdded` com o nome real em `metadata.name`. */
const nameSql = sql`coalesce(analytics_events.metadata->>'name', analytics_events.event_name)`

export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read')
  if (blocked) return blocked

  const [totals, byName, byDay, oldest, clicks] = await Promise.all([
    db.execute(sql`
      select
        count(*) filter (where timestamp > now() - interval '24 hours')::int as last24h,
        count(*) filter (where timestamp > now() - interval '7 days')::int as last7d,
        count(*) filter (where timestamp > now() - interval '30 days')::int as last30d,
        count(*)::int as total
      from analytics_events`),
    db.execute(sql`
      select ${nameSql} as name, count(*)::int as count, max(timestamp) as last_at
      from analytics_events where timestamp > now() - interval '30 days'
      group by 1 order by 2 desc limit 40`),
    db.execute(sql`
      select to_char(timestamp at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as day, count(*)::int as count
      from analytics_events where timestamp > now() - interval '14 days'
      group by 1 order by 1`),
    db.execute(sql`select min(timestamp) as oldest from analytics_events`),
    db.execute(sql`
      select count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as last7d,
             count(distinct session_id)::int as sessions
      from affiliate_clicks`),
  ])
  const tracking = await getSetting('tracking')
  return ok({
    totals: totals.rows[0],
    byName: byName.rows,
    byDay: byDay.rows,
    oldest: (oldest.rows[0] as { oldest: string | null }).oldest,
    outboundClicks: clicks.rows[0],
    disabledEvents: tracking.disabledEvents,
    retentionDays: tracking.retentionDays,
  })
}

/** Apaga eventos mais antigos que a retenção configurada em Medição. Cliques de afiliado não são tocados. */
export async function DELETE(request: Request) {
  const { blocked, userId } = await authorize(request, 'settings:write')
  if (blocked) return blocked
  const tracking = await getSetting('tracking')
  const days = Number(tracking.retentionDays)
  if (!Number.isFinite(days) || days < 30) return fail('Retenção inválida.', 422)
  const result = await db.execute(sql`delete from analytics_events where timestamp < now() - make_interval(days => ${days})`)
  const removed = Number(result.rowCount ?? 0)
  await recordAudit({ actorUserId: userId, action: 'eventos.purge', entityType: 'eventos', entityId: `>${days}d`, after: { removed } })
  return ok({ removed, retentionDays: days })
}
