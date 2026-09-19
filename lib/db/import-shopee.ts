import { fetchAllProductOffers, ShopeeApiError, type ShopeeProductOffer } from '@/lib/providers/shopee/client'
import { isUsableOffer, toCatalogItem, type CatalogItem } from '@/lib/providers/shopee/mapping'
import { archiveProductsWithoutAffiliateOffer, countCatalog, getOrCreateProvider, importCatalogItems } from '@/lib/db/repositories/catalog-import'

/** Cada categoria da vitrine é alimentada por buscas reais na Shopee. */
export const categoryGroups = [
  { slug: 'tecnologia', name: 'Tecnologia', keywords: ['fone de ouvido bluetooth', 'smartwatch', 'carregador usb c', 'mouse sem fio'] },
  { slug: 'casa', name: 'Casa', keywords: ['organizador armario', 'luminaria led', 'jogo de cama casal', 'aspirador portatil'] },
  { slug: 'audio', name: 'Áudio', keywords: ['caixa de som bluetooth', 'headset gamer', 'microfone condensador'] },
  { slug: 'cozinha', name: 'Cozinha', keywords: ['air fryer', 'panela antiaderente', 'liquidificador', 'garrafa termica'] },
  { slug: 'bem-estar', name: 'Bem-estar', keywords: ['kit skincare', 'creme hidratante corporal', 'escova de dente eletrica'] },
] as const

export type ImportOptions = { perCategory?: number; perKeyword?: number; minRating?: number; minSales?: number; replaceDemo?: boolean }

export async function importShopeeCatalog(options: ImportOptions = {}) {
  const { perCategory = 8, perKeyword = 40, minRating = 4.5, minSales = 50, replaceDemo = false } = options
  const providerId = await getOrCreateProvider('shopee', 'Shopee')
  const categoryNames = Object.fromEntries(categoryGroups.map((group) => [group.slug, group.name]))
  const seen = new Set<string>()
  const selected: CatalogItem[] = []

  for (const group of categoryGroups) {
    const candidates: ShopeeProductOffer[] = []
    for (const keyword of group.keywords) {
      const offers = await fetchAllProductOffers({ keyword, sortType: 2 }, perKeyword, 2)
      candidates.push(...offers.filter((offer) => isUsableOffer(offer, { minRating, minSales })))
    }
    const ranked = candidates
      .filter((offer) => !seen.has(String(offer.itemId)))
      .sort((a, b) => Number(b.sales) - Number(a.sales))
      .slice(0, perCategory)
    for (const offer of ranked) seen.add(String(offer.itemId))
    selected.push(...ranked.map((offer) => toCatalogItem(offer, group.slug)))
    console.log(`${group.name}: ${ranked.length} produtos de ${candidates.length} ofertas analisadas`)
  }

  const summary = await importCatalogItems(selected, providerId, categoryNames)
  const removed = replaceDemo ? await archiveProductsWithoutAffiliateOffer() : []
  return { summary, removed, total: selected.length, catalog: await countCatalog() }
}

async function main() {
  const flag = (name: string, fallback: number) => {
    const raw = process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split('=')[1]
    const parsed = raw === undefined ? NaN : Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const options: ImportOptions = {
    perCategory: flag('per-category', 8),
    minRating: flag('min-rating', 4.5),
    minSales: flag('min-sales', 50),
    replaceDemo: process.argv.includes('--replace-demo'),
  }
  console.log('Importando catálogo real da Shopee...', options)
  try {
    const result = await importShopeeCatalog(options)
    console.log(`\nImportados: ${result.summary.created} novos, ${result.summary.updated} atualizados, ${result.summary.priceChanges} com preço registrado no histórico.`)
    if (result.removed.length) console.log(`Arquivados ${result.removed.length} produtos sem oferta de afiliado: ${result.removed.join(', ')}`)
    console.log(`Catálogo agora: ${result.catalog.products} produtos, ${result.catalog.offers} ofertas (${result.catalog.withAffiliate} com link de afiliado).`)
  } catch (error) {
    if (error instanceof ShopeeApiError) console.error(`Erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
    else console.error(error)
    process.exit(1)
  }
  process.exit(0)
}

if (process.argv[1]?.includes('import-shopee')) main()
