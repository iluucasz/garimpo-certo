import { upcomingEvents } from './calendar'

/**
 * Regras da Engine, todas funções puras: recebem números e devolvem propostas. Nada aqui lê o banco nem muda dado;
 * quem aplica é `lib/engine/store.ts`, depois de a equipe aprovar (ou do modo automático, nos tipos de baixo risco).
 */

export type EngineConfig = {
  /** Janela, em dias, usada para medir visitas, cliques e favoritos. */
  windowDays: number
  /** Visitas a produtos no site inteiro, na janela, abaixo das quais a faxina não sugere nada (dado insuficiente). */
  minSiteViews: number
  /** Idade mínima do produto no catálogo antes de poder ser sugerido para sair. */
  minAgeDays: number
  /**
   * Visitas que o PRODUTO precisa ter tido na janela para poder sair. Sem isso, num catálogo grande a faxina arquivaria
   * produtos que ninguém abriu simplesmente por falta de exposição. 0 = também sai quem nunca foi visto.
   */
  minProductViews: number
  /** Máximo de produtos sugeridos para sair por execução. */
  maxPerRun: number
  /** Parte máxima do catálogo ativo que a faxina pode sugerir de uma vez (0–1). */
  maxShare: number
  seasonalEnabled: boolean
  lookaheadDays: number
  /** Aprender com os cliques: sugere importar mais das categorias que rendem e prioriza-as nas postagens. */
  learnEnabled: boolean
  /** Cliques de compra no site inteiro, na janela, abaixo dos quais comparar categorias não faz sentido. */
  minSiteClicks: number
  /** Quantos produtos a mais por categoria uma sugestão de cota pede. */
  quotaExtra: number
}

export const defaultEngineConfig: EngineConfig = {
  windowDays: 30, minSiteViews: 500, minAgeDays: 30, minProductViews: 10, maxPerRun: 10, maxShare: 0.1, seasonalEnabled: true, lookaheadDays: 40,
  learnEnabled: true, minSiteClicks: 50, quotaExtra: 10,
}

export type ProductSignal = {
  id: string
  name: string
  slug: string
  createdAt: string
  /** Editado à mão no painel: a Engine não mexe. */
  locked: boolean
  views: number
  clicks: number
  favorites: number
  conversions: number
  soldCount: number
}

export type ProposalDraft = {
  kind: 'archive_product' | 'import_term' | 'category_quota'
  subjectType: 'product' | 'term' | 'category'
  subjectId: string
  title: string
  reason: string
  evidence: Record<string, unknown>
  payload: Record<string, unknown>
  expiresAt: string | null
}

const dayMs = 86_400_000

export type PruneResult = {
  proposals: ProposalDraft[]
  /** Por que não houve proposta, quando for o caso (mostrado ao dono). */
  note: string | null
  coverage: { siteViews: number; minSiteViews: number; eligible: number; activeProducts: number }
}

/**
 * Faxina do catálogo: sugere tirar o que o público não abre nem clica, para abrir vaga para outro produto.
 * Só age com tráfego suficiente (senão "ninguém clicou" é só falta de visitantes) e nunca sugere um produto que
 * já converteu, foi favoritado, foi editado pela equipe ou entrou há pouco.
 */
export function pruneProposals(signals: ProductSignal[], siteViews: number, config: EngineConfig, now = Date.now()): PruneResult {
  const coverage = { siteViews, minSiteViews: config.minSiteViews, eligible: 0, activeProducts: signals.length }
  if (siteViews < config.minSiteViews) {
    return {
      proposals: [], coverage,
      note: `Poucos dados para decidir: o site teve ${siteViews} visitas a produtos nos últimos ${config.windowDays} dias e a faxina só começa com ${config.minSiteViews}. Só contam visitantes que permitiram a medição.`,
    }
  }
  const candidates = signals
    .filter((signal) => !signal.locked && now - new Date(signal.createdAt).getTime() >= config.minAgeDays * dayMs)
    .filter((signal) => signal.clicks === 0 && signal.favorites === 0 && signal.conversions === 0)
    .filter((signal) => signal.views >= config.minProductViews)
  coverage.eligible = candidates.length
  const cap = Math.max(1, Math.min(config.maxPerRun, Math.floor(signals.length * config.maxShare)))
  // Pior primeiro: mais visitas sem nenhum clique.
  const ranked = [...candidates].sort((a, b) => b.views - a.views || a.soldCount - b.soldCount).slice(0, cap)

  const proposals = ranked.map((signal): ProposalDraft => ({
    kind: 'archive_product', subjectType: 'product', subjectId: signal.id,
    title: `Tirar “${signal.name}” da vitrine`,
    reason: signal.views > 0
      ? `Teve ${signal.views} ${signal.views === 1 ? 'visita' : 'visitas'} em ${config.windowDays} dias e nenhum clique, favorito ou compra.`
      : `Nenhuma visita, clique, favorito ou compra em ${config.windowDays} dias, num site com ${siteViews} visitas a produtos no período.`,
    evidence: { windowDays: config.windowDays, views: signal.views, clicks: signal.clicks, favorites: signal.favorites, conversions: signal.conversions, siteViews },
    payload: { productId: signal.id, slug: signal.slug },
    expiresAt: new Date(now + 14 * dayMs).toISOString(),
  }))
  return { proposals, coverage, note: proposals.length === 0 ? 'Nenhum produto atende aos critérios de saída.' : null }
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Radar de tendências pelo calendário: perto de uma data comercial, sugere termos de busca para o importador
 * trazer produtos da época. Ignora termos que o importador já usa e os que já têm proposta ativa.
 */
export function seasonalProposals(today: string, config: EngineConfig, known: Set<string>): ProposalDraft[] {
  if (!config.seasonalEnabled) return []
  const knownNormalized = new Set([...known].map(normalize))
  const seen = new Set<string>()
  const drafts: ProposalDraft[] = []
  for (const event of upcomingEvents(today, config.lookaheadDays)) {
    for (const term of event.terms) {
      const key = `${term.category}:${normalize(term.keyword)}`
      if (seen.has(key) || knownNormalized.has(normalize(term.keyword))) continue
      seen.add(key)
      drafts.push({
        kind: 'import_term', subjectType: 'term', subjectId: key,
        title: `Importar “${term.keyword}” (${term.category}) para ${event.name}`,
        reason: `${event.name} é em ${event.daysUntil === 0 ? 'hoje' : event.daysUntil === 1 ? '1 dia' : `${event.daysUntil} dias`} (${event.date.split('-').reverse().join('/')}). Trazer produtos do tema agora dá tempo de o catálogo e as coleções estarem prontos.`,
        evidence: { event: event.id, eventName: event.name, date: event.date, daysUntil: event.daysUntil },
        payload: { category: term.category, keyword: term.keyword, event: event.id, until: event.until },
        expiresAt: `${event.until}T23:59:59.000Z`,
      })
    }
  }
  return drafts
}

// ---------------------------------------------------------------- aprender com os cliques

export type CategoryStat = {
  slug: string
  name: string
  /** Produtos ativos cuja categoria principal é esta. */
  products: number
  views: number
  clicks: number
  conversions: number
}

export type CategoryPerformance = CategoryStat & {
  /** Parte dos cliques do site que veio da categoria (0–1). */
  clickShare: number
  /** Parte dos produtos ativos que ela tem (0–1). */
  productShare: number
  /** Cliques reais ÷ cliques esperados pelo tamanho da categoria. 1 = na média. */
  ratio: number
}

/** Compara cada categoria com a média: quem tem mais cliques do que o seu tamanho "merece" rende acima do esperado. */
export function categoryPerformance(stats: CategoryStat[]): { totalClicks: number; categories: CategoryPerformance[] } {
  const totalClicks = stats.reduce((sum, item) => sum + item.clicks, 0)
  const totalProducts = stats.reduce((sum, item) => sum + item.products, 0)
  const categories = stats.map((item): CategoryPerformance => {
    const productShare = totalProducts > 0 ? item.products / totalProducts : 0
    const clickShare = totalClicks > 0 ? item.clicks / totalClicks : 0
    return { ...item, clickShare, productShare, ratio: productShare > 0 ? clickShare / productShare : 0 }
  })
  return { totalClicks, categories: categories.sort((a, b) => b.ratio - a.ratio) }
}

export type QuotaResult = { proposals: ProposalDraft[]; note: string | null; totalClicks: number; categories: CategoryPerformance[] }

const MAX_QUOTA_PROPOSALS = 3
const QUOTA_EFFECT_DAYS = 30

/**
 * Cota de importação: categorias que rendem bem acima da média pedem mais produtos na próxima importação.
 * Só age com cliques suficientes no site inteiro; com pouco dado, "rende mais" seria sorte.
 */
export function quotaProposals(stats: CategoryStat[], config: EngineConfig, now = Date.now()): QuotaResult {
  const { totalClicks, categories } = categoryPerformance(stats)
  if (!config.learnEnabled) return { proposals: [], note: null, totalClicks, categories }
  if (totalClicks < config.minSiteClicks) {
    return {
      proposals: [], totalClicks, categories,
      note: `Poucos cliques para comparar categorias: ${totalClicks} nos últimos ${config.windowDays} dias, e a Engine só aprende com ${config.minSiteClicks}. Só contam visitantes que permitiram a medição.`,
    }
  }
  const until = new Date(now + QUOTA_EFFECT_DAYS * dayMs)
  const proposals = categories
    .filter((item) => item.clicks >= 5 && item.ratio >= 1.5)
    .slice(0, MAX_QUOTA_PROPOSALS)
    .map((item): ProposalDraft => ({
      kind: 'category_quota', subjectType: 'category', subjectId: item.slug,
      title: `Importar +${config.quotaExtra} produtos em ${item.name}`,
      reason: `${item.name} tem ${Math.round(item.clickShare * 100)}% dos cliques com ${Math.round(item.productShare * 100)}% dos produtos (${item.ratio.toFixed(1).replace('.', ',')}× a média) nos últimos ${config.windowDays} dias. Mais opções nela tendem a render mais.`,
      evidence: { windowDays: config.windowDays, clicks: item.clicks, conversions: item.conversions, siteClicks: totalClicks, clickShare: Math.round(item.clickShare * 100), productShare: Math.round(item.productShare * 100) },
      payload: { category: item.slug, extra: config.quotaExtra, until: until.toISOString().slice(0, 10) },
      expiresAt: `${until.toISOString().slice(0, 10)}T23:59:59.000Z`,
    }))
  return { proposals, totalClicks, categories, note: proposals.length === 0 ? 'Nenhuma categoria rende acima da média o bastante para pedir mais produtos.' : null }
}

/** Multiplicador (1 a 1,25) que a escolha das postagens aplica à nota de cada categoria que rende acima da média. */
export function categoryBoosts(stats: CategoryStat[], config: Pick<EngineConfig, 'learnEnabled' | 'minSiteClicks'>): Record<string, number> {
  if (!config.learnEnabled) return {}
  const { totalClicks, categories } = categoryPerformance(stats)
  if (totalClicks < config.minSiteClicks) return {}
  const boosts: Record<string, number> = {}
  for (const item of categories) {
    if (item.clicks < 5 || item.ratio <= 1) continue
    boosts[item.slug] = Math.round((1 + Math.min(0.25, (item.ratio - 1) * 0.12)) * 1000) / 1000
  }
  return boosts
}
