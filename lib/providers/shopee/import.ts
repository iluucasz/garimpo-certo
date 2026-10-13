import { fetchAllProductOffers, type ShopeeProductOffer } from './client'
import { isUsableOffer, toCatalogItem, type CatalogItem } from './mapping'
import { archiveProductsOutsideSelection, archiveProductsWithoutAffiliateOffer, countCatalog, getOrCreateProvider, importCatalogItems } from '@/lib/db/repositories/catalog-import'

/** Cada categoria da vitrine é alimentada por buscas reais na Shopee. */
export const categoryGroups = [
  { slug: 'tecnologia', name: 'Tecnologia', keywords: ['fone de ouvido bluetooth', 'smartwatch', 'carregador usb c', 'mouse sem fio', 'suporte de celular', 'ring light', 'power bank'] },
  { slug: 'casa', name: 'Casa', keywords: ['organizador armario', 'luminaria led', 'jogo de cama casal', 'aspirador portatil', 'umidificador de ar', 'tapete antiderrapante', 'dispenser de sabonete'] },
  { slug: 'audio', name: 'Áudio', keywords: ['caixa de som bluetooth', 'headset gamer', 'microfone condensador', 'fone bluetooth esportivo', 'mini caixa de som'] },
  { slug: 'cozinha', name: 'Cozinha', keywords: ['air fryer', 'panela antiaderente', 'liquidificador', 'garrafa termica', 'mini processador', 'copo termico canudo', 'forma de silicone'] },
  { slug: 'bem-estar', name: 'Bem-estar', keywords: ['kit skincare', 'creme hidratante corporal', 'escova de dente eletrica', 'massageador', 'escova secadora', 'lixa eletrica'] },
  { slug: 'pet', name: 'Pet', keywords: ['cama para cachorro', 'comedouro pet', 'brinquedo para cachorro', 'arranhador para gato', 'caixa de transporte pet'] },
  { slug: 'beleza', name: 'Beleza', keywords: ['kit maquiagem', 'secador de cabelo', 'prancha alisadora', 'esponja de maquiagem', 'base liquida'] },
  { slug: 'fitness', name: 'Fitness', keywords: ['garrafa academia', 'elastico de resistencia', 'tapete de yoga', 'corda de pular', 'luva de treino'] },
] as const

export type ImportOptions = { perCategory?: number; perKeyword?: number; minRating?: number; minSales?: number; maxPerShop?: number; replaceDemo?: boolean; prune?: boolean }

export async function importShopeeCatalog(options: ImportOptions = {}) {
  const { perCategory = 12, perKeyword = 40, minRating = 4.5, minSales = 50, maxPerShop = 2, replaceDemo = false, prune = false } = options
  const providerId = await getOrCreateProvider('shopee', 'Shopee')
  const categoryNames = Object.fromEntries(categoryGroups.map((group) => [group.slug, group.name]))
  const seen = new Set<string>()
  const perShop = new Map<number, number>()
  const selected: CatalogItem[] = []

  for (const group of categoryGroups) {
    const candidates: { keyword: string; offer: ShopeeProductOffer }[] = []
    for (const keyword of group.keywords) {
      const offers = await fetchAllProductOffers({ keyword, sortType: 2 }, perKeyword, 2)
      candidates.push(...offers.filter((offer) => isUsableOffer(offer, { minRating, minSales })).map((offer) => ({ keyword, offer })))
    }
    // Cota por palavra-chave: sem isso uma busca campeã de vendas toma a categoria inteira.
    const perKeywordQuota = Math.max(1, Math.ceil(perCategory / group.keywords.length))
    const fromKeyword = new Map<string, number>()
    const ranked: ShopeeProductOffer[] = []
    const pool = candidates
      .filter((item) => !seen.has(String(item.offer.itemId)))
      .sort((a, b) => Number(b.offer.sales) - Number(a.offer.sales))
    // Primeira passada respeita a cota por palavra-chave e por loja; a segunda completa a categoria.
    for (const respeitaCota of [true, false]) {
      for (const { keyword, offer } of pool) {
        if (ranked.length >= perCategory) break
        if (seen.has(String(offer.itemId))) continue
        if (respeitaCota && (fromKeyword.get(keyword) ?? 0) >= perKeywordQuota) continue
        if ((perShop.get(offer.shopId) ?? 0) >= maxPerShop) continue
        ranked.push(offer)
        seen.add(String(offer.itemId))
        perShop.set(offer.shopId, (perShop.get(offer.shopId) ?? 0) + 1)
        fromKeyword.set(keyword, (fromKeyword.get(keyword) ?? 0) + 1)
      }
    }
    selected.push(...ranked.map((offer) => toCatalogItem(offer, group.slug)))
    console.log(`${group.name}: ${ranked.length} produtos de ${candidates.length} ofertas analisadas`)
  }

  const summary = await importCatalogItems(selected, providerId, categoryNames)
  const removed = replaceDemo ? await archiveProductsWithoutAffiliateOffer() : []
  const pruned = prune ? await archiveProductsOutsideSelection(selected.map((item) => item.externalId), providerId) : []
  return { summary, removed, pruned, total: selected.length, externalIds: selected.map((item) => item.externalId), providerId, catalog: await countCatalog() }
}
