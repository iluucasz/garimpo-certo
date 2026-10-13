import { archiveProductsOutsideSelection, countCatalog } from '@/lib/db/repositories/catalog-import'
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

async function execute(): Promise<CatalogRunResult> {
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
