import { fetchAllProductOffers, type ShopeeProductOffer } from './client'
import { toCatalogItem, type CatalogItem } from './mapping'
import { defaultMix, highTicketMix, selectForCategory, tierLabels, type Candidate, type SelectionState, type TierMix } from './selection'
import { archiveProductsOutsideSelection, archiveProductsWithoutAffiliateOffer, countCatalog, getOrCreateProvider, importCatalogItems } from '@/lib/db/repositories/catalog-import'

/**
 * Cada categoria da vitrine é alimentada por três tipos de busca na Shopee:
 * - `keywords`: o que é popular no dia a dia (buscas por palavra-chave, ordenadas por vendas);
 * - `premiumKeywords`: o produto principal de valor mais alto (a seleção por faixa de preço descarta os acessórios);
 * - `shopeeCategoryIds`: categorias internas da Shopee, que devolvem o produto em si e não acessórios
 *   (ex.: 101073 = consoles). O código vem do campo `productCatIds` das ofertas.
 */
export type CategorySource = {
  slug: string
  name: string
  keywords: readonly string[]
  premiumKeywords?: readonly string[]
  shopeeCategoryIds?: readonly number[]
  /** Faixas de preço desejadas. `highTicket` para categorias cujo produto principal é caro. */
  mix?: 'default' | 'highTicket'
}

export const categoryGroups: readonly CategorySource[] = [
  { slug: 'tecnologia', name: 'Tecnologia', keywords: ['fone de ouvido bluetooth', 'smartwatch', 'carregador usb c', 'mouse sem fio', 'suporte de celular', 'ring light', 'power bank'], premiumKeywords: ['tablet android', 'smartwatch amazfit', 'camera de seguranca wifi', 'projetor 4k', 'teclado mecanico'], shopeeCategoryIds: [100073] },
  { slug: 'casa', name: 'Casa', keywords: ['organizador armario', 'luminaria led', 'jogo de cama casal', 'aspirador portatil', 'umidificador de ar', 'tapete antiderrapante', 'dispenser de sabonete'], premiumKeywords: ['colchao queen', 'ventilador de torre', 'purificador de ar', 'cortina blackout', 'jogo de panelas'] },
  { slug: 'audio', name: 'Áudio', keywords: ['caixa de som bluetooth', 'headset gamer', 'microfone condensador', 'fone bluetooth esportivo', 'mini caixa de som'], premiumKeywords: ['soundbar', 'caixa de som jbl', 'fone bluetooth jbl', 'headphone sony', 'microfone sem fio'], shopeeCategoryIds: [100578] },
  { slug: 'cozinha', name: 'Cozinha', keywords: ['air fryer', 'panela antiaderente', 'liquidificador', 'garrafa termica', 'mini processador', 'copo termico canudo', 'forma de silicone'], premiumKeywords: ['air fryer forno 12 litros', 'cafeteira expresso', 'batedeira planetaria', 'fogao cooktop', 'sanduicheira grill'] },
  { slug: 'bem-estar', name: 'Bem-estar', keywords: ['kit skincare', 'creme hidratante corporal', 'escova de dente eletrica', 'massageador', 'escova secadora', 'lixa eletrica'], premiumKeywords: ['massageador eletrico pistola', 'balanca de bioimpedancia', 'cadeira de massagem', 'aparelho de pressao'] },
  { slug: 'pet', name: 'Pet', keywords: ['cama para cachorro', 'comedouro pet', 'brinquedo para cachorro', 'arranhador para gato', 'caixa de transporte pet'], premiumKeywords: ['fonte bebedouro para gatos', 'comedouro automatico', 'casinha pet', 'caixa de areia automatica'] },
  { slug: 'beleza', name: 'Beleza', keywords: ['kit maquiagem', 'secador de cabelo', 'prancha alisadora', 'esponja de maquiagem', 'base liquida'], premiumKeywords: ['secador de cabelo profissional', 'prancha profissional', 'kit pinceis maquiagem profissional', 'perfume importado'] },
  { slug: 'fitness', name: 'Fitness', keywords: ['garrafa academia', 'elastico de resistencia', 'tapete de yoga', 'corda de pular', 'luva de treino'], premiumKeywords: ['esteira eletrica', 'bicicleta ergometrica', 'kit halteres', 'banco de musculacao', 'whey protein'] },
  // Categorias de produto principal caro: a maior parte da cota é de itens a partir de R$ 100/500.
  { slug: 'games', name: 'Games', keywords: ['console playstation 5', 'nintendo switch console', 'xbox series console', 'controle ps5 dualsense', 'headset gamer'], premiumKeywords: ['cadeira gamer', 'monitor gamer 144hz', 'mouse gamer', 'teclado gamer'], shopeeCategoryIds: [101073, 101933], mix: 'highTicket' },
  { slug: 'eletronicos', name: 'Eletrônicos', keywords: ['smartphone 128gb', 'notebook intel core i5', 'smart tv 50 polegadas 4k', 'tablet', 'monitor 24 polegadas'], premiumKeywords: ['iphone', 'samsung galaxy', 'redmi xiaomi', 'notebook gamer', 'ssd 1tb'], shopeeCategoryIds: [100185, 101942], mix: 'highTicket' },
  { slug: 'eletrodomesticos', name: 'Eletrodomésticos', keywords: ['geladeira frost free', 'maquina de lavar roupas', 'air fryer 7 litros', 'robo aspirador', 'micro-ondas'], premiumKeywords: ['fogao 5 bocas', 'lava e seca', 'ar condicionado split', 'aspirador de po vertical'], shopeeCategoryIds: [100209, 100184], mix: 'highTicket' },
]

export type ImportOptions = {
  /** Produtos por categoria. Padrão 24 (era 12): com 11 categorias, cerca de 260 produtos. */
  perCategory?: number
  perKeyword?: number
  minRating?: number
  /** Corte de vendas da faixa básica; as faixas altas usam proporções menores (itens caros vendem menos). */
  minSales?: number
  maxPerShop?: number
  replaceDemo?: boolean
  prune?: boolean
  /** Só seleciona e devolve os itens; não escreve nada no banco. Usado para pré-visualizar a seleção. */
  dryRun?: boolean
  /** Termos extras por categoria (datas comerciais aprovadas na Engine). Somam-se às buscas de `categoryGroups`. */
  extraKeywords?: { category: string; keyword: string }[]
  /** Produtos a mais por categoria (slug), aprovados na Engine para as que rendem acima da média. */
  categoryBonus?: Record<string, number>
}

type Counted = { offers: ShopeeProductOffer[]; failed: boolean }

const SEARCH_CONCURRENCY = 3

async function search(query: Parameters<typeof fetchAllProductOffers>[0], total: number): Promise<Counted> {
  try {
    return { offers: await fetchAllProductOffers({ ...query, sortType: 2 }, total, 2), failed: false }
  } catch (error) {
    // Uma busca que falha não derruba a importação inteira; a categoria segue com as demais.
    console.warn(`  busca ignorada (${JSON.stringify(query)}): ${error instanceof Error ? error.message : error}`)
    return { offers: [], failed: true }
  }
}

export async function importShopeeCatalog(options: ImportOptions = {}) {
  const { perCategory = 40, perKeyword = 40, minRating = 4.5, minSales = 50, maxPerShop = 2, replaceDemo = false, prune = false, dryRun = false, extraKeywords = [], categoryBonus = {} } = options
  const providerId = dryRun ? '' : await getOrCreateProvider('shopee', 'Shopee')
  const categoryNames = Object.fromEntries(categoryGroups.map((group) => [group.slug, group.name]))
  const state: SelectionState = { seen: new Set<string>(), perShop: new Map<number, number>() }
  const selected: CatalogItem[] = []
  const minSalesByTier: TierMix = { essencial: minSales, intermediario: Math.max(10, Math.round(minSales * 0.6)), premium: Math.max(5, Math.round(minSales * 0.3)) }

  for (const group of categoryGroups) {
    const queries: { query: Parameters<typeof fetchAllProductOffers>[0]; total: number; source: string }[] = [
      ...group.keywords.map((keyword) => ({ query: { keyword }, total: perKeyword, source: `kw:${keyword}` })),
      ...(group.premiumKeywords ?? []).map((keyword) => ({ query: { keyword }, total: perKeyword, source: `pk:${keyword}` })),
      ...(group.shopeeCategoryIds ?? []).map((productCatId) => ({ query: { productCatId }, total: 100, source: `cat:${productCatId}` })),
      ...extraKeywords.filter((extra) => extra.category === group.slug).map((extra) => ({ query: { keyword: extra.keyword }, total: perKeyword, source: `seasonal:${extra.keyword}` })),
    ]
    // Poucas buscas ao mesmo tempo: a API da Shopee limita a taxa, e o cliente já refaz a chamada quando recusa.
    const results: Counted[] = []
    for (let start = 0; start < queries.length; start += SEARCH_CONCURRENCY) {
      results.push(...await Promise.all(queries.slice(start, start + SEARCH_CONCURRENCY).map((item) => search(item.query, item.total))))
    }
    const failures = results.filter((item) => item.failed).length
    if (failures === queries.length) throw new Error(`Nenhuma busca da categoria ${group.name} funcionou; a importação foi interrompida.`)
    // A ordem das fontes é a de `queries`, para a seleção ser determinística.
    const candidates: Candidate[] = results.flatMap((item, index) => item.offers.map((offer) => ({ offer, source: queries[index].source })))

    const result = selectForCategory(candidates, {
      perCategory: Math.min(80, perCategory + (categoryBonus[group.slug] ?? 0)), minRating, maxPerShop, minSales: minSalesByTier,
      mix: group.mix === 'highTicket' ? highTicketMix : defaultMix,
    }, state)
    selected.push(...result.offers.map((offer) => toCatalogItem(offer, group.slug)))
    const tiers = (['essencial', 'intermediario', 'premium'] as const).map((tier) => `${tierLabels[tier]}: ${result.byTier[tier]}`).join(' · ')
    console.log(`${group.name}: ${result.offers.length} produtos (${tiers}) de ${result.analyzed} ofertas analisadas${failures ? `, ${failures} busca(s) falharam` : ''}`)
  }

  if (dryRun) {
    return {
      summary: { created: 0, updated: 0, priceChanges: 0 }, removed: [] as string[], pruned: [] as string[], total: selected.length,
      externalIds: selected.map((item) => item.externalId), providerId, catalog: { products: 0, offers: 0, withAffiliate: 0 }, items: selected,
    }
  }
  const summary = await importCatalogItems(selected, providerId, categoryNames)
  const removed = replaceDemo ? await archiveProductsWithoutAffiliateOffer() : []
  const pruned = prune ? await archiveProductsOutsideSelection(selected.map((item) => item.externalId), providerId) : []
  return { summary, removed, pruned, total: selected.length, externalIds: selected.map((item) => item.externalId), providerId, catalog: await countCatalog(), items: selected }
}
