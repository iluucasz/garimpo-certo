import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Números das abas de Experiência e a situação da home (publicada ou em rascunho). */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const result = await db.execute(sql`
    select
      (select count(*)::int from campaigns where status = 'active') as campanhas,
      (select count(*)::int from segments) as segmentos,
      (select count(*)::int from feature_flags) as flags,
      (select count(*)::int from ab_experiments where status = 'running') as testes,
      (select to_char(published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from site_documents where key = 'home') as home_published_at,
      (select draft is not null from site_documents where key = 'home') as home_has_draft`)
  const row = result.rows[0] as Record<string, number | string | boolean | null>
  const n = (key: string) => Number(row[key] ?? 0)
  return ok({
    counts: { campanhas: n('campanhas'), segmentos: n('segmentos'), flags: n('flags'), testes: n('testes') },
    home: { publishedAt: row.home_published_at ? String(row.home_published_at) : null, hasDraft: row.home_has_draft === true },
  })
}
