import { archiveProductsOutsideSelection, countCatalog } from '@/lib/db/repositories/catalog-import'
import { importShopeeCatalog } from './import'
import { activeCategoryBonuses, activeSeasonalTerms, loadImportSettings } from '@/lib/engine/store'
import { closeRun, openRun } from './job-runs'

/** Só arquiva produtos que saíram da seleção se a importação trouxe uma parte razoável do catálogo atual. */
export const MIN_COVERAGE_TO_PRUNE = 0.7

/** Ofertas que cada busca traz ao acumular: mais fundo que o top de vendas, onde estão os produtos novos. */
const ACCUMULATE_DEPTH = 150
/** Novos por categoria a cada importação quando a leitura do painel falha. */
const DEFAULT_NEW_PER_CATEGORY = 10

let running: Promise<CatalogRunResult> | null = null

export type CatalogRunResult = {
  created: number
  updated: number
  priceChanges: number
  selected: number
  /** Produtos novos nesta importação (ao acumular) e quantos antigos foram reatualizados. */
  added: number
  refreshed: number
  archived: number
  prunedSkipped: boolean
  catalog: { products: number; offers: number; withAffiliate: number }
  durationMs: number
}

export const CATALOG_JOB_TYPE = 'catalog_import'

/** `refreshBudget` menor nas execuções dentro de uma função da Vercel (limite de 300 s); o worker da VPS usa o do padrão. */
export type RunOptions = { refreshBudget?: number }

async function execute(options: RunOptions): Promise<CatalogRunResult> {
  const runId = await openRun(CATALOG_JOB_TYPE, '0 6 * * *')
  try {
    const result = await runImport(options)
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

async function runImport(options: RunOptions): Promise<CatalogRunResult> {
  const startedAt = Date.now()
  const before = await countCatalog()
  // Termos de datas comerciais que a equipe aprovou na Engine; se a leitura falhar, a importação segue sem eles.
  const extraKeywords = await activeSeasonalTerms().catch(() => [])
  // Os números da importação vêm do painel (Engine → Importação); se a leitura falhar, valem os padrões.
  const [settings, categoryBonus] = await Promise.all([loadImportSettings().catch(() => null), activeCategoryBonuses().catch(() => ({}))])
  // Por padrão o catálogo acumula (cresce todo dia, sem limite); desligado, volta a ser uma seleção fixa por categoria.
  const accumulate = settings ? settings.accumulate : true
  const result = await importShopeeCatalog({
    prune: false, extraKeywords, categoryBonus, accumulate,
    ...(options.refreshBudget !== undefined ? { refreshBudget: options.refreshBudget } : {}),
    ...(accumulate ? { perKeyword: ACCUMULATE_DEPTH } : {}),
    ...(settings ? {
      perCategory: accumulate ? settings.newPerCategory : settings.perCategory,
      minRating: settings.minRating, minSales: settings.minSales, maxPerShop: settings.maxPerShop, maxCatalog: settings.maxCatalog,
    } : { perCategory: accumulate ? DEFAULT_NEW_PER_CATEGORY : undefined }),
  })

  let pruned: string[] = []
  // A poda por cobertura só existe na seleção fixa; acumulando, nada sai da vitrine só por não estar entre os melhores de hoje.
  const coverage = before.products > 0 ? result.total / before.products : 1
  if (!accumulate && result.total >= 5 && coverage >= MIN_COVERAGE_TO_PRUNE) {
    pruned = await archiveProductsOutsideSelection(result.externalIds, result.providerId)
  }

  return {
    created: result.summary.created,
    updated: result.summary.updated,
    priceChanges: result.summary.priceChanges,
    selected: result.total,
    added: result.newItems,
    refreshed: result.refreshed,
    archived: pruned.length + result.qualityArchived.length,
    prunedSkipped: !accumulate && pruned.length === 0 && coverage < MIN_COVERAGE_TO_PRUNE,
    catalog: result.catalog,
    durationMs: Date.now() - startedAt,
  }
}

/**
 * Importa o catálogo da Shopee e poda o que saiu da seleção (com a salvaguarda de cobertura).
 * Uma única execução por vez por instância: pedidos simultâneos (cron + botão do admin) compartilham o resultado.
 */
export function runCatalogImport(options: RunOptions = {}): Promise<CatalogRunResult> {
  if (!running) running = execute(options).finally(() => { running = null })
  return running
}
