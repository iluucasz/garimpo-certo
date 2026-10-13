import { archiveProductsOutsideSelection, countCatalog } from '@/lib/db/repositories/catalog-import'
import { importShopeeCatalog } from './import'
import { activeSeasonalTerms } from '@/lib/engine/store'
import { closeRun, openRun } from './job-runs'

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

export const CATALOG_JOB_TYPE = 'catalog_import'

async function execute(): Promise<CatalogRunResult> {
  const runId = await openRun(CATALOG_JOB_TYPE, '0 6 * * *')
  try {
    const result = await runImport()
    await closeRun(runId, {
      status: result.selected === 0 ? 'partial' : 'succeeded',
      processed: result.selected, created: result.created, updated: result.updated, rejected: result.archived,
    }, CATALOG_JOB_TYPE)
    return result
  } catch (error) {
    await closeRun(runId, { status: 'failed', error: error instanceof Error ? error.message : String(error) }, CATALOG_JOB_TYPE)
    throw error
  }
}

async function runImport(): Promise<CatalogRunResult> {
  const startedAt = Date.now()
  const before = await countCatalog()
  // Termos de datas comerciais que a equipe aprovou na Engine; se a leitura falhar, a importação segue sem eles.
  const extraKeywords = await activeSeasonalTerms().catch(() => [])
  const result = await importShopeeCatalog({ prune: false, extraKeywords })

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
