import { desc, eq, sql } from 'drizzle-orm'
import { cachedQuery } from '@/lib/db/cached'
import { db } from '@/lib/db/client'
import { abExperiments } from '@/lib/db/schema'
import { compare, experimentTag, type Comparison, type VariantCopy, type VariantStats } from '@/lib/experiments/core'

export const EXPERIMENT_TAG = 'experiments'
export type ExperimentRow = typeof abExperiments.$inferSelect

export type RunningExperiment = { key: string; name: string; splitB: number; variantB: VariantCopy }

const loadRunning = async (): Promise<RunningExperiment | null> => {
  const [row] = await db.select().from(abExperiments).where(eq(abExperiments.status, 'running')).limit(1)
  return row ? { key: row.key, name: row.name, splitB: row.splitB, variantB: row.variantB as VariantCopy } : null
}

/** O teste em andamento (no máximo um), com cache de 5 min e invalidação ao iniciar ou parar. */
export const getRunningExperiment = cachedQuery(loadRunning, ['ab-running-v1'], [EXPERIMENT_TAG, 'settings'])

export type ExperimentResults = { a: VariantStats; b: VariantStats; comparison: Comparison }

/**
 * Exposições (visitas distintas que viram a variante) e conversões (visitas distintas que clicaram em comprar
 * depois de ver a variante). Só conta o período em que o teste esteve em andamento.
 */
export async function resultsFor(row: ExperimentRow): Promise<ExperimentResults> {
  // Sem limite superior enquanto roda; assim relógios diferentes entre o app e o banco não cortam eventos recentes.
  const since = row.startedAt ?? row.createdAt
  const until = row.stoppedAt
  const [exposures, clicks] = await Promise.all([
    db.execute(sql`
      select metadata->>'variant' as variant, count(distinct session_id)::int as n
      from analytics_events
      where event_name = 'experiment_exposure' and metadata->>'experiment' = ${row.key} and "timestamp" >= ${since}
        and (${until}::timestamptz is null or "timestamp" <= ${until}::timestamptz)
      group by 1`),
    db.execute(sql`
      select right(sub_id, 1) as variant, count(distinct session_id)::int as n
      from affiliate_clicks
      where created_at >= ${since} and (${until}::timestamptz is null or created_at <= ${until}::timestamptz)
        and (sub_id like ${`%\\_${experimentTag(row.key, 'a')}`} or sub_id like ${`%\\_${experimentTag(row.key, 'b')}`})
      group by 1`),
  ])
  const pick = (rows: { rows: unknown[] }, variant: string) => Number((rows.rows as { variant: string; n: number }[]).find((item) => item.variant === variant)?.n ?? 0)
  const a = { exposed: pick(exposures, 'a'), converted: pick(clicks, 'a') }
  const b = { exposed: pick(exposures, 'b'), converted: pick(clicks, 'b') }
  return { a, b, comparison: compare(a, b) }
}

export async function listExperiments() {
  const rows = await db.select().from(abExperiments).orderBy(desc(abExperiments.createdAt)).limit(30)
  return Promise.all(rows.map(async (row) => ({ row, results: await resultsFor(row) })))
}

export async function getExperiment(id: string) {
  const [row] = await db.select().from(abExperiments).where(eq(abExperiments.id, id)).limit(1)
  return row ?? null
}
