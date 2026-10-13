/**
 * Personalização no aparelho. O perfil é calculado a partir do que a pessoa viu, favoritou e comparou, que já
 * fica no navegador dela; nada disso é enviado ao servidor nem cruzado com outras pessoas. Funções puras.
 *
 * Só vale com a personalização permitida (`cookiePreferences.personalization`): quem cuida disso é o chamador.
 */

export type AffinityProduct = { id: string; category: string; brand: string; score: number }

export type Interactions = {
  /** Mais recente primeiro. */
  recent: string[]
  favorites: string[]
  compare: string[]
}

export type Profile = {
  categories: Record<string, number>
  brands: Record<string, number>
  /** Faixa de preço em que a pessoa costuma olhar, ou null sem dados. */
  priceBand: { low: number; high: number } | null
  /** Quantos sinais (produtos distintos com interação) sustentam o perfil. */
  signals: number
}

/** Favoritar diz mais que comparar, que diz mais que só abrir. */
const WEIGHT = { favorite: 3, compare: 2, recent: 1 } as const
export const MIN_SIGNALS = 2

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildProfile(
  interactions: Interactions,
  products: AffinityProduct[],
  priceOf: (productId: string) => number,
  /** Categorias que a pessoa escolheu à mão em Minha conta (peso próprio, não depende de histórico). */
  declared: string[] = [],
): Profile {
  const byId = new Map(products.map((product) => [product.id, product]))
  const weights = new Map<string, number>()
  const add = (id: string, weight: number) => { if (byId.has(id)) weights.set(id, (weights.get(id) ?? 0) + weight) }
  interactions.favorites.forEach((id) => add(id, WEIGHT.favorite))
  interactions.compare.forEach((id) => add(id, WEIGHT.compare))
  // O que foi visto há pouco pesa mais que o que foi visto há tempo.
  interactions.recent.forEach((id, index) => add(id, WEIGHT.recent * Math.max(0.3, 1 - index * 0.08)))

  const categories: Record<string, number> = {}
  const brands: Record<string, number> = {}
  const prices: number[] = []
  for (const [id, weight] of weights) {
    const product = byId.get(id)!
    categories[product.category] = (categories[product.category] ?? 0) + weight
    brands[product.brand] = (brands[product.brand] ?? 0) + weight
    const price = priceOf(id)
    if (price > 0) prices.push(price)
  }
  for (const slug of declared) categories[slug] = (categories[slug] ?? 0) + WEIGHT.favorite

  const mid = prices.length ? median(prices) : 0
  return {
    categories, brands, priceBand: mid > 0 ? { low: mid * 0.4, high: mid * 2.2 } : null,
    signals: weights.size,
  }
}

const normalize = (values: Record<string, number>) => {
  const max = Math.max(0, ...Object.values(values))
  return (key: string) => (max > 0 ? (values[key] ?? 0) / max : 0)
}

export type RankedForYou = { product: AffinityProduct; score: number; why: 'category' | 'brand' | 'quality' }

/**
 * Ordena o catálogo para a pessoa: afinidade de categoria (mais peso), marca, adequação de preço e qualidade.
 * Não repete o que ela já favoritou e coloca o que ela acabou de ver depois do que é novo.
 */
export function rankForYou(products: AffinityProduct[], profile: Profile, interactions: Interactions, priceOf: (productId: string) => number): RankedForYou[] {
  const category = normalize(profile.categories)
  const brand = normalize(profile.brands)
  const favorites = new Set(interactions.favorites)
  const seen = new Set(interactions.recent.slice(0, 8))
  return products
    .filter((product) => !favorites.has(product.id))
    .map((product) => {
      const price = priceOf(product.id)
      const fit = !profile.priceBand || price <= 0 ? 0.5 : price >= profile.priceBand.low && price <= profile.priceBand.high ? 1 : 0.1
      const cat = category(product.category)
      const bra = brand(product.brand)
      const score = cat * 0.5 + bra * 0.12 + fit * 0.14 + (product.score / 100) * 0.24 - (seen.has(product.id) ? 0.25 : 0)
      const why: RankedForYou['why'] = cat >= 0.5 ? 'category' : bra >= 0.5 ? 'brand' : 'quality'
      return { product, score, why }
    })
    .filter((item) => item.score > 0.15)
    .sort((a, b) => b.score - a.score)
}
