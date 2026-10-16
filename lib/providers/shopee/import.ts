import { fetchAllProductOffers, fetchProductOffers, type ShopeeProductOffer } from './client'
import { toCatalogItem, type CatalogItem } from './mapping'
import { defaultMix, highTicketMix, nameKey, selectForCategory, tierLabels, tierOf, type Candidate, type SelectionState, type TierId, type TierMix } from './selection'
import { archiveProductsByExternalIds, archiveProductsOutsideSelection, archiveProductsWithoutAffiliateOffer, countCatalog, findProviderId, getOrCreateProvider, importCatalogItems, listKnownProducts } from '@/lib/db/repositories/catalog-import'

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
  // Mais públicos: moda, calçados, acessórios, infantil, casa e lazer. As buscas são por palavra-chave, ordenadas por vendas.
  { slug: 'moda-feminina', name: 'Moda feminina', keywords: ['vestido feminino', 'blusa feminina', 'calca legging', 'conjunto feminino', 'pijama feminino', 'saia feminina', 'short feminino'], premiumKeywords: ['jaqueta feminina', 'vestido de festa', 'bolsa de couro feminina', 'casaco feminino'] },
  { slug: 'moda-masculina', name: 'Moda masculina', keywords: ['camiseta masculina', 'bermuda masculina', 'cueca boxer', 'meia masculina', 'camisa masculina', 'calca jeans masculina', 'moletom masculino'], premiumKeywords: ['jaqueta masculina', 'jaqueta de couro', 'kit camisetas masculinas', 'terno masculino'] },
  { slug: 'calcados', name: 'Calçados', keywords: ['tenis casual', 'chinelo slide', 'sandalia feminina', 'tenis esportivo', 'sapatilha', 'bota feminina', 'chinelo masculino'], premiumKeywords: ['tenis nike', 'tenis adidas', 'tenis corrida', 'bota de couro'] },
  { slug: 'acessorios', name: 'Acessórios', keywords: ['colar feminino', 'brinco', 'pulseira', 'oculos de sol', 'anel', 'relogio digital', 'bone'], premiumKeywords: ['relogio feminino', 'relogio masculino', 'oculos de sol polarizado', 'carteira de couro'] },
  { slug: 'infantil', name: 'Infantil e bebê', keywords: ['brinquedo educativo', 'roupa de bebe', 'mochila infantil', 'mamadeira', 'pelucia', 'fralda descartavel', 'quebra cabeca infantil'], premiumKeywords: ['carrinho de bebe', 'bebe conforto', 'berco', 'cadeirinha para carro'] },
  { slug: 'papelaria', name: 'Papelaria e escritório', keywords: ['caderno', 'caneta gel', 'agenda', 'organizador de mesa', 'mochila escolar', 'estojo escolar', 'post it'], premiumKeywords: ['cadeira de escritorio', 'impressora', 'mesa de escritorio', 'lousa magnetica'] },
  { slug: 'automotivo', name: 'Automotivo', keywords: ['suporte veicular celular', 'aspirador automotivo', 'capa de volante', 'carregador veicular', 'organizador de porta malas', 'cera automotiva', 'tapete automotivo'], premiumKeywords: ['camera de re', 'central multimidia', 'capacete moto', 'compressor de ar portatil'] },
  { slug: 'ferramentas', name: 'Ferramentas', keywords: ['jogo de chaves', 'kit ferramentas', 'trena', 'fita isolante', 'lanterna led', 'nivel a laser', 'alicate'], premiumKeywords: ['furadeira', 'parafusadeira', 'lavadora de alta pressao', 'serra circular'] },
  { slug: 'jardim', name: 'Jardim e quintal', keywords: ['mangueira de jardim', 'vaso de planta', 'kit jardinagem', 'regador', 'irrigador', 'piscina inflavel', 'rede de descanso'], premiumKeywords: ['churrasqueira', 'cortador de grama', 'piscina estrutural', 'gazebo'] },
  { slug: 'suplementos', name: 'Suplementos', keywords: ['creatina monohidratada', 'whey protein', 'multivitaminico', 'colageno', 'pre treino', 'barra de proteina', 'coqueteleira'], premiumKeywords: ['whey protein 900g', 'creatina 300g', 'kit suplementos'] },
  { slug: 'viagem', name: 'Viagem e mochilas', keywords: ['mala de viagem', 'mochila notebook', 'necessaire', 'travesseiro de pescoco', 'organizador de mala', 'bolsa termica', 'pochete'], premiumKeywords: ['mala de bordo', 'mochila antifurto', 'kit malas de viagem'] },
  { slug: 'esporte', name: 'Esporte e lazer', keywords: ['bola de futebol', 'patins', 'barraca de camping', 'squeeze', 'raquete', 'skate', 'bola de volei'], premiumKeywords: ['bicicleta aro 29', 'patinete eletrico', 'barraca 4 pessoas', 'prancha stand up'] },
  { slug: 'cama-mesa-banho', name: 'Cama, mesa e banho', keywords: ['toalha de banho', 'jogo de lencol', 'edredom', 'travesseiro', 'cobertor', 'jogo americano', 'toalha de rosto'], premiumKeywords: ['colcha queen', 'kit toalhas', 'edredom king', 'travesseiro viscoelastico'] },
  { slug: 'hobbies', name: 'Hobbies', keywords: ['jogo de tabuleiro', 'quebra cabeca', 'kit de pintura', 'linha de croche', 'livro best seller', 'ukulele', 'baralho'], premiumKeywords: ['violao', 'teclado musical', 'telescopio', 'maquina de costura'] },
]

export type ImportOptions = {
  /**
   * Produtos por categoria. Sem acumular é o total desejado de cada categoria; ao acumular é quantos produtos
   * NOVOS entram por categoria a cada importação.
   */
  perCategory?: number
  /** Quantas ofertas cada busca traz (de 50 em 50, por vendas). Quanto mais fundo, mais produtos novos aparecem. */
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
  /**
   * Acumula: o catálogo só cresce. Mantém o que já entrou, acrescenta produtos novos todo dia e reatualiza os
   * existentes (arquiva o que perdeu a nota mínima ou saiu da Shopee). Não há limite de tamanho.
   */
  accumulate?: boolean
  /** Teto de produtos ativos ao acumular; 0 ou ausente = sem limite. */
  maxCatalog?: number
  /** Só estas categorias (slugs). Serve para testar uma categoria nova sem refazer todas. */
  onlyCategories?: string[]
  /**
   * Índice Garimpo mínimo para um produto NOVO entrar (só ao acumular). Faixas mais caras aceitam alguns pontos a menos,
   * porque itens caros vendem menos. 0 desliga o corte. É o que define "bom": entra tudo o que passa, sem cota.
   */
  minIndex?: number
  /** Quantos produtos antigos são reatualizados por importação, os de sincronização mais antiga primeiro. */
  refreshBudget?: number
}

type Counted = { offers: ShopeeProductOffer[]; failed: boolean }

const SEARCH_CONCURRENCY = 3
/** Quantos pontos de Índice a faixa aceita a menos que a básica. */
export const INDEX_TIER_OFFSET: Record<TierId, number> = { essencial: 0, intermediario: 5, premium: 10 }
/** O produto novo passa no corte de Índice? Faixas mais caras aceitam alguns pontos a menos. `minIndex` 0 não corta. */
export const passesIndexGate = (score: number, price: number, minIndex: number) => minIndex <= 0 || score >= minIndex - INDEX_TIER_OFFSET[tierOf(price)]

/** Teto técnico por categoria (era 80): só existe para um valor digitado errado não pedir milhares de buscas. */
export const MAX_PER_CATEGORY = 2000
/** Reatualizações por importação quando o painel não define. Cada uma é uma chamada à API da Shopee. */
export const DEFAULT_REFRESH_BUDGET = Number.POSITIVE_INFINITY
/** Ao acumular, uma loja pode ter até esta fração do catálogo (mínimo `maxPerShop`), para o catálogo grande não ficar travado em 2 por loja. */
export const SHOP_SHARE = 0.005

async function search(query: Parameters<typeof fetchAllProductOffers>[0], total: number): Promise<Counted> {
  try {
    const pages = Math.max(2, Math.ceil(total / 50))
    return { offers: await fetchAllProductOffers({ ...query, sortType: 2 }, total, pages), failed: false }
  } catch (error) {
    // Uma busca que falha não derruba a importação inteira; a categoria segue com as demais.
    console.warn(`  busca ignorada (${JSON.stringify(query)}): ${error instanceof Error ? error.message : error}`)
    return { offers: [], failed: true }
  }
}

const priceOf = (offer: ShopeeProductOffer) => Number(offer.priceMin) || Number(offer.price) || 0
const isUsable = (offer: ShopeeProductOffer) => Boolean(offer.imageUrl) && Boolean(offer.offerLink) && priceOf(offer) > 0

/** Quantas lojas diferentes cada nome de vendedor já tem no catálogo ativo. */
export function shopCounts(sellers: (string | null)[]) {
  const counts = new Map<string, number>()
  for (const seller of sellers) if (seller) counts.set(seller, (counts.get(seller) ?? 0) + 1)
  return counts
}

export async function importShopeeCatalog(options: ImportOptions = {}) {
  const {
    perCategory = 40, perKeyword = 40, minRating = 4.5, minSales = 50, maxPerShop = 2, replaceDemo = false, prune = false, dryRun = false,
    extraKeywords = [], categoryBonus = {}, accumulate = false, maxCatalog = 0, minIndex = 0, refreshBudget = DEFAULT_REFRESH_BUDGET, onlyCategories,
  } = options
  const providerId = dryRun ? await findProviderId('shopee') : await getOrCreateProvider('shopee', 'Shopee')
  const categoryNames = Object.fromEntries(categoryGroups.map((group) => [group.slug, group.name]))
  const state: SelectionState = { seen: new Set<string>(), perShop: new Map<number, number>() }
  const selected: CatalogItem[] = []
  const minSalesByTier: TierMix = { essencial: minSales, intermediario: Math.max(10, Math.round(minSales * 0.6)), premium: Math.max(5, Math.round(minSales * 0.3)) }

  // Ao acumular: o que já existe não é escolhido de novo (nem o que foi arquivado), e a seleção respeita o que o catálogo já tem.
  const known = accumulate && providerId ? await listKnownProducts(providerId) : []
  const knownById = new Map(known.map((item) => [item.externalId, item]))
  const active = known.filter((item) => item.status === 'active')
  for (const item of known) state.seen.add(item.externalId)
  const shopBaseline = shopCounts(active.map((item) => item.sellerName))
  const keysByCategory = new Map<string, Set<string>>()
  for (const item of active) {
    if (!item.categorySlug) continue
    const keys = keysByCategory.get(item.categorySlug) ?? new Set<string>()
    keys.add(nameKey(item.name))
    keysByCategory.set(item.categorySlug, keys)
  }
  const shopCap = accumulate ? Math.max(maxPerShop, Math.ceil(active.length * SHOP_SHARE)) : maxPerShop
  let room = accumulate && maxCatalog > 0 ? Math.max(0, maxCatalog - active.length) : Number.POSITIVE_INFINITY
  const refreshed = new Map<string, CatalogItem>()
  const toArchive = new Set<string>()
  const depth = Math.max(perKeyword, accumulate ? 100 : perKeyword)

  /** Produto que já está no catálogo e voltou nas buscas: reatualiza, ou arquiva se perdeu a nota mínima. */
  function absorb(offer: ShopeeProductOffer, fallbackCategory: string) {
    const id = String(offer.itemId)
    const existing = knownById.get(id)
    if (!existing || existing.status !== 'active' || refreshed.has(id) || toArchive.has(id)) return
    const category = existing.categorySlug ?? fallbackCategory
    if (!category || !isUsable(offer)) return
    if ((Number(offer.ratingStar) || 0) < minRating) { toArchive.add(id); return }
    refreshed.set(id, toCatalogItem(offer, category))
  }

  for (const group of categoryGroups) {
    if (onlyCategories && !onlyCategories.includes(group.slug)) continue
    const queries: { query: Parameters<typeof fetchAllProductOffers>[0]; total: number; source: string }[] = [
      ...group.keywords.map((keyword) => ({ query: { keyword }, total: depth, source: `kw:${keyword}` })),
      ...(group.premiumKeywords ?? []).map((keyword) => ({ query: { keyword }, total: depth, source: `pk:${keyword}` })),
      ...(group.shopeeCategoryIds ?? []).map((productCatId) => ({ query: { productCatId }, total: 100, source: `cat:${productCatId}` })),
      ...extraKeywords.filter((extra) => extra.category === group.slug).map((extra) => ({ query: { keyword: extra.keyword }, total: depth, source: `seasonal:${extra.keyword}` })),
    ]
    // Poucas buscas ao mesmo tempo: a API da Shopee limita a taxa, e o cliente já refaz a chamada quando recusa.
    const results: Counted[] = []
    for (let start = 0; start < queries.length; start += SEARCH_CONCURRENCY) {
      results.push(...await Promise.all(queries.slice(start, start + SEARCH_CONCURRENCY).map((item) => search(item.query, item.total))))
    }
    const failures = results.filter((item) => item.failed).length
    if (failures === queries.length) {
      // Seleção fixa: sem busca não há como decidir o que fica, então para. Acumulando nada sai por isso: a categoria é pulada.
      if (!accumulate) throw new Error(`Nenhuma busca da categoria ${group.name} funcionou; a importação foi interrompida.`)
      console.warn(`${group.name}: nenhuma busca funcionou; categoria pulada nesta importação.`)
      continue
    }
    // A ordem das fontes é a de `queries`, para a seleção ser determinística.
    const candidates: Candidate[] = results.flatMap((item, index) => item.offers.map((offer) => ({ offer, source: queries[index].source })))
    if (accumulate) for (const { offer } of candidates) absorb(offer, group.slug)

    // Ao acumular, `perCategory` 0 = sem cota: entra tudo o que passa nos cortes de qualidade.
    const wanted = accumulate && perCategory <= 0 ? MAX_PER_CATEGORY : Math.min(MAX_PER_CATEGORY, perCategory + (categoryBonus[group.slug] ?? 0))
    const allowed = Math.min(wanted, room)
    const pool = accumulate && minIndex > 0
      ? candidates.filter(({ offer }) => passesIndexGate(toCatalogItem(offer, group.slug).editorialScore, priceOf(offer), minIndex))
      : candidates
    const result = allowed > 0
      ? selectForCategory(pool, {
        perCategory: allowed, minRating, maxPerShop: shopCap, minSales: minSalesByTier,
        mix: group.mix === 'highTicket' ? highTicketMix : defaultMix,
        ...(accumulate ? { knownKeys: keysByCategory.get(group.slug), shopBaseline } : {}),
      }, state)
      : { offers: [] as ShopeeProductOffer[], analyzed: candidates.length, byTier: { essencial: 0, intermediario: 0, premium: 0 } as TierMix }
    room -= result.offers.length
    selected.push(...result.offers.map((offer) => toCatalogItem(offer, group.slug)))
    const tiers = (['essencial', 'intermediario', 'premium'] as const).map((tier) => `${tierLabels[tier]}: ${result.byTier[tier]}`).join(' · ')
    console.log(`${group.name}: ${result.offers.length} ${accumulate ? 'novos' : 'produtos'} (${tiers}) de ${result.analyzed} ofertas analisadas${failures ? `, ${failures} busca(s) falharam` : ''}`)
  }

  // Produtos antigos que não voltaram nas buscas: reatualiza os de sincronização mais antiga, pelo id, dentro do orçamento.
  if (accumulate && !dryRun && refreshBudget > 0) {
    const due = active
      .filter((item) => !refreshed.has(item.externalId) && !toArchive.has(item.externalId))
      .sort((a, b) => (a.lastSyncedAt ?? '').localeCompare(b.lastSyncedAt ?? ''))
      .slice(0, refreshBudget)
    const missing: string[] = []
    let looked = 0
    for (let start = 0; start < due.length; start += SEARCH_CONCURRENCY) {
      await Promise.all(due.slice(start, start + SEARCH_CONCURRENCY).map(async (item) => {
        try {
          const { nodes } = await fetchProductOffers({ itemId: Number(item.externalId), limit: 1 })
          looked += 1
          const offer = nodes.find((node) => String(node.itemId) === item.externalId)
          if (offer) absorb(offer, '')
          else missing.push(item.externalId)
        } catch {
          // Falha da API não é motivo para mexer no produto: ele é tentado de novo na próxima importação.
        }
      }))
    }
    // Salvaguarda: se "sumiu" for uma fatia grande das consultas, é a API falhando, não a Shopee tirando tudo do ar.
    if (looked > 0 && missing.length / looked <= 0.2) for (const id of missing) toArchive.add(id)
    console.log(`Reatualizados ${due.length - missing.length} produtos antigos${missing.length ? `; ${missing.length} sem resposta da Shopee` : ''}.`)
  }

  const everything = [...selected, ...refreshed.values()]

  if (dryRun) {
    return {
      summary: { created: 0, updated: 0, priceChanges: 0 }, removed: [] as string[], pruned: [] as string[], qualityArchived: [...toArchive],
      total: everything.length, newItems: selected.length, refreshed: refreshed.size,
      externalIds: everything.map((item) => item.externalId), providerId, catalog: { products: 0, offers: 0, withAffiliate: 0 }, items: everything,
    }
  }
  const summary = await importCatalogItems(everything, providerId, categoryNames)
  const removed = replaceDemo ? await archiveProductsWithoutAffiliateOffer() : []
  const pruned = prune ? await archiveProductsOutsideSelection(everything.map((item) => item.externalId), providerId) : []
  const qualityArchived = await archiveProductsByExternalIds([...toArchive], providerId)
  return {
    summary, removed, pruned, qualityArchived, total: everything.length, newItems: selected.length, refreshed: refreshed.size,
    externalIds: everything.map((item) => item.externalId), providerId, catalog: await countCatalog(), items: everything,
  }
}
