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
  /** Máximo de produtos sugeridos para sair por execução. */
  maxPerRun: number
  /** Parte máxima do catálogo ativo que a faxina pode sugerir de uma vez (0–1). */
  maxShare: number
  seasonalEnabled: boolean
  lookaheadDays: number
}

export const defaultEngineConfig: EngineConfig = {
  windowDays: 30, minSiteViews: 500, minAgeDays: 30, maxPerRun: 10, maxShare: 0.1, seasonalEnabled: true, lookaheadDays: 40,
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
  kind: 'archive_product' | 'import_term'
  subjectType: 'product' | 'term'
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
  coverage.eligible = candidates.length
  const cap = Math.max(1, Math.min(config.maxPerRun, Math.floor(signals.length * config.maxShare)))
  // Pior primeiro: quem foi visto e ignorado pesa mais que quem nem foi aberto (pode só estar mal posicionado).
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
