import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { archiveProductsOutsideSelection, countCatalog, getOrCreateProvider } from '@/lib/db/repositories/catalog-import'
import { syncErrors, syncJobRuns, syncJobs } from '@/lib/db/schema'
import { importShopeeCatalog } from './import'

/** Só arquiva produtos que saíram da seleção se a importação trouxe uma parte razoável do catálogo atual. */
export const MIN_COVERAGE_TO_PRUNE = 0.7

let running: Promise<CatalogRunResult> | null = null

export type CatalogRunResult = {
  created: number
  updated: number
  priceChanges: number
  selected: number
  archived: number
  prunedSkipped: boolean
  catalog: { products: number; offers: number; withAffiliate: number }
  durationMs: number
}

const JOB_TYPE = 'catalog_import'

/** Abre (e cria, na primeira vez) o registro de execução. Se o banco falhar, a importação segue sem histórico. */
async function openRun() {
  try {
    const providerId = await getOrCreateProvider('shopee', 'Shopee')
    let [job] = await db.select({ id: syncJobs.id }).from(syncJobs).where(and(eq(syncJobs.providerId, providerId), eq(syncJobs.jobType, JOB_TYPE))).limit(1)
    if (!job) [job] = await db.insert(syncJobs).values({ providerId, jobType: JOB_TYPE, scheduleCron: '0 6 * * *' }).returning({ id: syncJobs.id })
    const [run] = await db.insert(syncJobRuns).values({ syncJobId: job.id }).returning({ id: syncJobRuns.id })
    return run.id
  } catch (error) {
    console.error('[import] não foi possível abrir o registro da execução', error instanceof Error ? error.message : error)
    return null
  }
}

async function closeRun(runId: string | null, outcome: { status: 'succeeded' | 'failed' | 'partial'; result?: CatalogRunResult; error?: string }) {
  if (!runId) return
  try {
    await db.update(syncJobRuns).set({
      status: outcome.status,
      finishedAt: new Date().toISOString(),
      processedCount: outcome.result?.selected ?? 0,
      createdCount: outcome.result?.created ?? 0,
      updatedCount: outcome.result?.updated ?? 0,
      rejectedCount: outcome.result?.archived ?? 0,
    }).where(eq(syncJobRuns.id, runId))
    if (outcome.error) await db.insert(syncErrors).values({ syncJobRunId: runId, errorMessage: outcome.error.slice(0, 1000) })
  } catch (error) {
    console.error('[import] não foi possível fechar o registro da execução', error instanceof Error ? error.message : error)
  }
}

async function execute(): Promise<CatalogRunResult> {
  const runId = await openRun()
  try {
    const result = await runImport()
    await closeRun(runId, { status: result.selected === 0 ? 'partial' : 'succeeded', result })
    return result
  } catch (error) {
    await closeRun(runId, { status: 'failed', error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

async function runImport(): Promise<CatalogRunResult> {
  const startedAt = Date.now()
  const before = await countCatalog()
  const result = await importShopeeCatalog({ prune: false })

  let pruned: string[] = []
  const coverage = before.products > 0 ? result.total / before.products : 1
  if (result.total >= 5 && coverage >= MIN_COVERAGE_TO_PRUNE) {
    pruned = await archiveProductsOutsideSelection(result.externalIds, result.providerId)
  }

  return {
    created: result.summary.created,
    updated: result.summary.updated,
    priceChanges: result.summary.priceChanges,
    selected: result.total,
    archived: pruned.length,
    prunedSkipped: pruned.length === 0 && coverage < MIN_COVERAGE_TO_PRUNE,
    catalog: result.catalog,
    durationMs: Date.now() - startedAt,
  }
}

/**
 * Importa o catálogo da Shopee e poda o que saiu da seleção (com a salvaguarda de cobertura).
 * Uma única execução por vez por instância: pedidos simultâneos (cron + botão do admin) compartilham o resultado.
 */
export function runCatalogImport(): Promise<CatalogRunResult> {
  if (!running) running = execute().finally(() => { running = null })
  return running
}
