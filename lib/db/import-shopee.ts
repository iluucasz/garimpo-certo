import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { importShopeeCatalog, type ImportOptions } from '@/lib/providers/shopee/import'

async function main() {
  const flag = (name: string, fallback: number) => {
    const raw = process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split('=')[1]
    const parsed = raw === undefined ? NaN : Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const options: ImportOptions = {
    perCategory: flag('per-category', 40),
    minRating: flag('min-rating', 4.5),
    minSales: flag('min-sales', 50),
    maxPerShop: flag('max-per-shop', 2),
    replaceDemo: process.argv.includes('--replace-demo'),
    prune: process.argv.includes('--prune'),
  }
  console.log('Importando catálogo real da Shopee...', options)
  try {
    const result = await importShopeeCatalog(options)
    console.log(`\nImportados: ${result.summary.created} novos, ${result.summary.updated} atualizados, ${result.summary.priceChanges} com preço registrado no histórico.`)
    if (result.removed.length) console.log(`Arquivados ${result.removed.length} produtos sem oferta de afiliado: ${result.removed.join(', ')}`)
    if (result.pruned.length) console.log(`Arquivados ${result.pruned.length} produtos que saíram da seleção desta importação.`)
    console.log(`Catálogo agora: ${result.catalog.products} produtos, ${result.catalog.offers} ofertas (${result.catalog.withAffiliate} com link de afiliado).`)
  } catch (error) {
    if (error instanceof ShopeeApiError) console.error(`Erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
    else console.error(error)
    process.exit(1)
  }
  process.exit(0)
}

if (process.argv[1]?.includes('import-shopee')) main()
