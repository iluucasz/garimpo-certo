import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/**
 * Contagens simples que aparecem nas abas de Conteúdo, Engine e Governança. Só números agregados, sem dados de pessoas.
 * Cada aba só aparece para quem tem permissão no módulo; aqui basta poder ler o catálogo.
 */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const result = await db.execute(sql`
    select
      (select count(*)::int from coupons where is_active and (ends_at is null or ends_at > now())) as cupons,
      (select count(*)::int from content_pages where kind = 'article' and status = 'published') as artigos,
      (select count(*)::int from content_pages where kind = 'page' and status = 'published') as paginas,
      (select count(*)::int from social_posts where status = 'pending' and channel = 'telegram') as postagens,
      (select count(*)::int from social_posts where status = 'pending' and channel in ('instagram', 'tiktok')) as conteudo,
      (select count(*)::int from engine_proposals where status = 'pending') as propostas,
      (select count(*)::int from privacy_requests where status = 'pending') as lgpd`)
  const row = result.rows[0] as Record<string, number | null>
  const n = (key: string) => Number(row[key] ?? 0)
  return ok({ counts: { cupons: n('cupons'), artigos: n('artigos'), paginas: n('paginas'), postagens: n('postagens'), conteudo: n('conteudo'), propostas: n('propostas'), lgpd: n('lgpd') } })
}
