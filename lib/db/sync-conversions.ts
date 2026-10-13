import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { DEFAULT_LOOKBACK_DAYS, runConversionSync } from '@/lib/providers/shopee/conversions-run'

/** `pnpm db:sync-conversions [--days=60]` — traz as comissões reais da Shopee (máximo 89 dias para trás). */
async function main() {
  const raw = process.argv.find((argument) => argument.startsWith('--days='))?.split('=')[1]
  const days = raw === undefined ? DEFAULT_LOOKBACK_DAYS : Number(raw)
  console.log(`Sincronizando conversões da Shopee (últimos ${Number.isFinite(days) ? days : DEFAULT_LOOKBACK_DAYS} dias)...`)
  try {
    const result = await runConversionSync(Number.isFinite(days) ? days : DEFAULT_LOOKBACK_DAYS)
    console.log(`Lidas ${result.fetched} conversões: ${result.created} novas, ${result.updated} atualizadas, ${result.unchanged} sem mudança.`)
    console.log(`Itens: ${result.items} (${result.itemsWithoutOffer} de produtos fora do catálogo). Levou ${Math.round(result.durationMs / 1000)} s.`)
  } catch (error) {
    if (error instanceof ShopeeApiError) console.error(`Erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
    else console.error(error)
    process.exit(1)
  }
  process.exit(0)
}

if (process.argv[1]?.includes('sync-conversions')) main()
