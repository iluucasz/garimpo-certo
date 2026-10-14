import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Números das abas do catálogo e a situação da última importação. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const result = await db.execute(sql`
    select
      (select count(*)::int from products where status = 'active') as produtos,
      (select count(*)::int from offers o join products p on p.id = o.product_id where o.status = 'active' and p.status = 'active') as ofertas,
      (select count(*)::int from categories) as categorias,
      (select count(*)::int from brands b where exists (select 1 from products p where p.brand_id = b.id and p.status = 'active')) as marcas,
      (select count(*)::int from tags) as tags,
      (select count(*)::int from curated_collections) as colecoes,
      (select count(*)::int from providers) as providers,
      (select r.status::text from sync_job_runs r join sync_jobs j on j.id = r.sync_job_id where j.job_type = 'catalog_import' order by r.started_at desc limit 1) as import_status,
      (select to_char(r.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from sync_job_runs r join sync_jobs j on j.id = r.sync_job_id where j.job_type = 'catalog_import' order by r.started_at desc limit 1) as import_at`)
  const row = result.rows[0] as Record<string, number | string | null>
  const n = (key: string) => Number(row[key] ?? 0)
  return ok({
    counts: { produtos: n('produtos'), ofertas: n('ofertas'), categorias: n('categorias'), marcas: n('marcas'), tags: n('tags'), colecoes: n('colecoes'), providers: n('providers') },
    lastImport: row.import_at ? { at: String(row.import_at), status: String(row.import_status ?? '') } : null,
  })
}
