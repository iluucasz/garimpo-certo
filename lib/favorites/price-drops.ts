/**
 * Queda de preço dos favoritos, sem e-mail nem conta: ao favoritar, o navegador guarda o preço do momento
 * (`garimpo:favorite-prices`); depois, a comparação com o preço atual diz se ficou mais barato.
 * Funções puras; o armazenamento fica no VisitorStateProvider.
 */

export const FAVORITE_PRICES_KEY = 'garimpo:favorite-prices'

export type Baseline = { price: number; at: string }
export type Baselines = Record<string, Baseline>

export type PriceDrop = { productId: string; from: number; to: number; amount: number; percent: number; since: string }

/** Ignora oscilação pequena: precisa cair ao menos 2% e R$ 1 para valer um aviso. */
export const MIN_DROP_PERCENT = 2
export const MIN_DROP_AMOUNT = 1

export function computeDrop(productId: string, baseline: Baseline | undefined, currentPrice: number): PriceDrop | null {
  if (!baseline || !(baseline.price > 0) || !(currentPrice > 0)) return null
  const amount = Math.round((baseline.price - currentPrice) * 100) / 100
  const percent = (amount / baseline.price) * 100
  if (amount < MIN_DROP_AMOUNT || percent < MIN_DROP_PERCENT) return null
  return { productId, from: baseline.price, to: currentPrice, amount, percent: Math.round(percent), since: baseline.at }
}

export function computeDrops(baselines: Baselines, favorites: string[], priceOf: (productId: string) => number): PriceDrop[] {
  return favorites
    .flatMap((id) => { const drop = computeDrop(id, baselines[id], priceOf(id)); return drop ? [drop] : [] })
    .sort((a, b) => b.percent - a.percent)
}

/** Guarda o preço de hoje para o que ainda não tem referência. Nunca sobrescreve: a referência é a de quando salvou. */
export function withBaselines(current: Baselines, ids: string[], priceOf: (productId: string) => number, now = new Date().toISOString()): Baselines {
  const next = { ...current }
  for (const id of ids) {
    const price = priceOf(id)
    if (!next[id] && price > 0) next[id] = { price, at: now }
  }
  return next
}

/** Sai do mapa o que deixou de ser favorito. */
export function onlyFavorites(baselines: Baselines, favorites: string[]): Baselines {
  const keep = new Set(favorites)
  return Object.fromEntries(Object.entries(baselines).filter(([id]) => keep.has(id)))
}
