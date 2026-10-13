import { getOrCreateProvider } from '@/lib/db/repositories/catalog-import'
import { upsertConversions, type ConversionUpsertSummary } from '@/lib/db/repositories/conversions-import'
import { fetchConversions, MAX_LOOKBACK_DAYS, toConversionRecord } from './conversions'
import { closeRun, openRun } from './job-runs'

export const CONVERSION_JOB_TYPE = 'conversion_sync'
/** Janela padrão: um pedido pode ser concluído ou cancelado semanas depois da compra. */
export const DEFAULT_LOOKBACK_DAYS = 60

export type ConversionRunResult = ConversionUpsertSummary & { fetched: number; windowDays: number; durationMs: number }

let running: Promise<ConversionRunResult> | null = null

async function execute(days: number): Promise<ConversionRunResult> {
  const windowDays = Math.min(Math.max(Math.trunc(days) || DEFAULT_LOOKBACK_DAYS, 1), MAX_LOOKBACK_DAYS)
  const runId = await openRun(CONVERSION_JOB_TYPE, '0 */3 * * *')
  const startedAt = Date.now()
  try {
    const end = Math.floor(Date.now() / 1000)
    const nodes = await fetchConversions({ start: end - windowDays * 86_400, end })
    const providerId = await getOrCreateProvider('shopee', 'Shopee')
    const summary = await upsertConversions(nodes.map(toConversionRecord), providerId)
    await closeRun(runId, {
      status: 'succeeded', processed: nodes.length, created: summary.created, updated: summary.updated,
    }, CONVERSION_JOB_TYPE)
    return { ...summary, fetched: nodes.length, windowDays, durationMs: Date.now() - startedAt }
  } catch (error) {
    await closeRun(runId, { status: 'failed', error: error instanceof Error ? error.message : String(error) }, CONVERSION_JOB_TYPE)
    throw error
  }
}

/**
 * Traz as comissões reais da Shopee (`conversionReport`) para `affiliate_conversions`.
 * Uma execução por vez por instância: pedidos simultâneos (worker + botão do painel) compartilham o resultado.
 */
export function runConversionSync(days = DEFAULT_LOOKBACK_DAYS): Promise<ConversionRunResult> {
  if (!running) running = execute(days).finally(() => { running = null })
  return running
}
