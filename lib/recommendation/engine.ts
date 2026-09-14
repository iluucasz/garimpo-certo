import { offers as defaultOffers, products as defaultProducts } from '@/lib/mock-data'
import type { Offer, Product } from '@/lib/types'

export type RecommendationCatalog = { products: Product[]; offers: Offer[] }

export const ALGORITHM_VERSION = 'mock-ranker-2.1.0'
export type CandidateSource = 'trending' | 'category' | 'similar' | 'history' | 'favorites' | 'co_visit' | 'co_click' | 'editorial' | 'price_drop' | 'high_rating' | 'new_products'
export type ReasonCode = 'TRENDING' | 'SIMILAR_PRODUCT' | 'BASED_ON_HISTORY' | 'BASED_ON_CATEGORY' | 'PRICE_DROP' | 'EDITORIAL_PICK' | 'HIGH_RATING' | 'EXPLORATION'
export type ScoringWeights = { relevance: number; affinity: number; engagement: number; quality: number; commercial: number; price: number; freshness: number; similarity: number }
export type RecommendationInput = {
  slot?: string; seed?: string; category?: string; productId?: string; exclude?: string[]; limit?: number
  interests?: Record<string, number>; favoriteIds?: string[]; historyIds?: string[]; explorationRate?: number
  weights?: Partial<ScoringWeights>; now?: Date
}
export type FeatureVector = {
  relevance: number; categoryAffinity: number; brandAffinity: number; priceAffinity: number; views: number
  ctr: number; favoriteRate: number; conversionRate: number; expectedCommission: number; rating: number
  reviewConfidence: number; priceDiscount: number; priceCompetitiveness: number; freshness: number
  availabilityConfidence: number; similarityScore: number; recency: number; trendingScore: number
}
export type RankedRecommendation = { product: Product; score: number; reasonCode: ReasonCode; reason: string; sources: CandidateSource[]; features: FeatureVector; bestProviderId: string; explored: boolean }
export type RecommendationSnapshot = { id: string; slot: string; seed: string; algorithmVersion: string; generatedAt: string; expiresAt: string; inputHash: string; recommendations: RankedRecommendation[]; diagnostics: { candidates: number; filtered: number; explorationCount: number; weights: ScoringWeights } }

const defaultWeights: ScoringWeights = { relevance: .18, affinity: .15, engagement: .14, quality: .16, commercial: .08, price: .12, freshness: .08, similarity: .09 }
const hash = (value: string) => [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261)
const ratio = (value: string) => (hash(value) % 10000) / 10000
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const bayesianRate = (successes: number, trials: number, prior = .045, strength = 80) => (successes + prior * strength) / (trials + strength)
const normalizeWeights = (patch: Partial<ScoringWeights> = {}) => {
  const merged = { ...defaultWeights, ...patch }
  const total = Object.values(merged).reduce((sum, value) => sum + Math.max(0, value), 0) || 1
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, Math.max(0, value) / total])) as ScoringWeights
}
const bestOffer = (catalogOffers: Offer[], productId: string) => catalogOffers.filter((offer) => offer.productId === productId && offer.stock !== 'indisponível').sort((a, b) => a.price + a.shipping - b.price - b.shipping)[0]
const sourceReason: Record<CandidateSource, [ReasonCode, string]> = {
  trending: ['TRENDING', 'Em alta agora'], category: ['BASED_ON_CATEGORY', 'Relevante para seus interesses'], similar: ['SIMILAR_PRODUCT', 'Parecido com o produto que você viu'],
  history: ['BASED_ON_HISTORY', 'Baseado no seu histórico'], favorites: ['BASED_ON_HISTORY', 'Parecido com produtos salvos'], co_visit: ['SIMILAR_PRODUCT', 'Visitantes também viram'],
  co_click: ['TRENDING', 'Frequentemente escolhido junto'], editorial: ['EDITORIAL_PICK', 'Escolha da curadoria'], price_drop: ['PRICE_DROP', 'Preço caiu recentemente'],
  high_rating: ['HIGH_RATING', 'Muito bem avaliado'], new_products: ['EXPLORATION', 'Novidade para descobrir'],
}

function sourceMembership(catalogProducts: Product[], product: Product, input: RecommendationInput, features: FeatureVector): CandidateSource[] {
  const sourceProduct = catalogProducts.find((item) => item.id === input.productId)
  const historyCategories = new Set(catalogProducts.filter((item) => input.historyIds?.includes(item.id)).map((item) => item.category))
  const favoriteBrands = new Set(catalogProducts.filter((item) => input.favoriteIds?.includes(item.id)).map((item) => item.brand))
  const sources: CandidateSource[] = []
  if (features.trendingScore > .5) sources.push('trending')
  if (input.category === product.category || (input.interests?.[product.category] ?? 0) > .35) sources.push('category')
  if (sourceProduct && (sourceProduct.category === product.category || sourceProduct.brand === product.brand)) sources.push('similar')
  if (historyCategories.has(product.category)) sources.push('history')
  if (favoriteBrands.has(product.brand)) sources.push('favorites')
  if (ratio(`visit:${input.seed}:${product.id}`) > .62) sources.push('co_visit')
  if (ratio(`click:${input.seed}:${product.id}`) > .72) sources.push('co_click')
  if (product.tags.some((tag) => /editor|comunidade|custo/i.test(tag))) sources.push('editorial')
  if (features.priceDiscount > .08) sources.push('price_drop')
  if (product.rating >= 4.7 && product.reviews >= 100) sources.push('high_rating')
  if (features.freshness > .72) sources.push('new_products')
  return sources.length ? sources : ['editorial']
}

function featuresFor(catalog: RecommendationCatalog, product: Product, input: RecommendationInput): FeatureVector {
  const offer = bestOffer(catalog.offers, product.id)
  const productOffers = catalog.offers.filter((item) => item.productId === product.id)
  const min = Math.min(...productOffers.map((item) => item.price + item.shipping))
  const max = Math.max(...productOffers.map((item) => item.price + item.shipping))
  const latest = product.priceHistory.at(-1)?.price ?? min
  const initial = product.priceHistory[0]?.price ?? latest
  const views = 20 + Math.floor(ratio(`views:${product.id}`) * 6000)
  const clicks = Math.floor(views * (.015 + ratio(`clicks:${product.id}`) * .13))
  const favorites = Math.floor(views * (.006 + ratio(`favorites:${product.id}`) * .075))
  const conversions = Math.floor(clicks * (.012 + ratio(`conversions:${product.id}`) * .11))
  const temporal = { h1: ratio(`1h:${product.id}`), h6: ratio(`6h:${product.id}`), h24: ratio(`24h:${product.id}`), d7: ratio(`7d:${product.id}`), d30: ratio(`30d:${product.id}`) }
  const trendingScore = clamp(temporal.h1 * .34 + temporal.h6 * .26 + temporal.h24 * .2 + temporal.d7 * .13 + temporal.d30 * .07)
  const sourceProduct = catalog.products.find((item) => item.id === input.productId)
  const categoryAffinity = clamp(input.category === product.category ? 1 : input.interests?.[product.category] ?? .12)
  const brandAffinity = clamp((input.favoriteIds ?? []).some((id) => catalog.products.find((item) => item.id === id)?.brand === product.brand) ? .9 : .2)
  const similarityScore = sourceProduct ? clamp((sourceProduct.category === product.category ? .6 : 0) + (sourceProduct.brand === product.brand ? .3 : 0) + ratio(`similar:${sourceProduct.id}:${product.id}`) * .1) : .25
  return {
    relevance: clamp(product.score / 100 * .65 + categoryAffinity * .35), categoryAffinity, brandAffinity,
    priceAffinity: clamp(1 - latest / 4000), views, ctr: bayesianRate(clicks, views), favoriteRate: bayesianRate(favorites, views, .018, 100),
    conversionRate: bayesianRate(conversions, clicks, .025, 60), expectedCommission: clamp(((offer?.price ?? latest) * (.025 + ratio(`commission:${product.id}`) * .055)) / 250),
    rating: clamp(product.rating / 5), reviewConfidence: clamp(Math.log10(product.reviews + 1) / 4), priceDiscount: clamp((initial - latest) / Math.max(initial, 1)),
    priceCompetitiveness: max === min ? .8 : clamp(1 - ((offer?.price ?? max) - min) / (max - min)), freshness: ratio(`fresh:${product.id}`),
    availabilityConfidence: offer ? .92 : 0, similarityScore, recency: clamp(.45 + temporal.h24 * .55), trendingScore,
  }
}

export function generateRecommendations(input: RecommendationInput = {}, catalog: RecommendationCatalog = { products: defaultProducts, offers: defaultOffers }): RecommendationSnapshot {
  const seed = input.seed ?? 'anonymous'; const slot = input.slot ?? 'home_for_you'; const limit = Math.max(1, Math.min(input.limit ?? 6, 20))
  const weights = normalizeWeights(input.weights); const excluded = new Set([...(input.exclude ?? []), ...(input.historyIds ?? []).slice(-1)])
  const generatedAt = input.now ?? new Date(); const explorationRate = clamp(input.explorationRate ?? .12)
  const scored = catalog.products.filter((product) => !excluded.has(product.id)).map((product) => {
    const features = featuresFor(catalog, product, input); const sources = sourceMembership(catalog.products, product, input, features)
    const affinity = features.categoryAffinity * .55 + features.brandAffinity * .25 + features.priceAffinity * .2
    const engagement = clamp(features.ctr * 4 + features.favoriteRate * 3 + features.trendingScore * .35)
    const quality = features.rating * .58 + features.reviewConfidence * .22 + product.score / 100 * .2
    const price = features.priceDiscount * .5 + features.priceCompetitiveness * .5
    const commercial = features.conversionRate * 3 * .55 + features.expectedCommission * .45
    const score = features.relevance * weights.relevance + affinity * weights.affinity + engagement * weights.engagement + quality * weights.quality + commercial * weights.commercial + price * weights.price + features.freshness * weights.freshness + features.similarityScore * weights.similarity
    const primary = [...sources].sort((a, b) => sourcePriority(b, input) - sourcePriority(a, input))[0]
    return { product, score, sources, features, bestProviderId: bestOffer(catalog.offers, product.id)?.providerId ?? 'none', explored: false, reasonCode: sourceReason[primary][0], reason: sourceReason[primary][1] } satisfies RankedRecommendation
  }).filter((item) => item.features.availabilityConfidence > 0).sort((a, b) => b.score - a.score)
  const explorationCount = Math.min(Math.floor(limit * explorationRate + .5), Math.max(0, limit - 1)); const selected: RankedRecommendation[] = []
  const categoryCount = new Map<string, number>(); const brandCount = new Map<string, number>(); const providerCount = new Map<string, number>()
  for (const item of scored) {
    if (selected.length >= limit - explorationCount) break
    if ((categoryCount.get(item.product.category) ?? 0) >= 2 || (brandCount.get(item.product.brand) ?? 0) >= 2 || (providerCount.get(item.bestProviderId) ?? 0) >= 3) continue
    selected.push(item); categoryCount.set(item.product.category, (categoryCount.get(item.product.category) ?? 0) + 1); brandCount.set(item.product.brand, (brandCount.get(item.product.brand) ?? 0) + 1); providerCount.set(item.bestProviderId, (providerCount.get(item.bestProviderId) ?? 0) + 1)
  }
  const explorationPool = scored.filter((item) => !selected.includes(item)).sort((a, b) => ratio(`explore:${seed}:${b.product.id}`) - ratio(`explore:${seed}:${a.product.id}`))
  for (const item of explorationPool.slice(0, explorationCount)) selected.push({ ...item, explored: true, reasonCode: 'EXPLORATION', reason: 'Novidade para você descobrir' })
  for (const item of scored) { if (selected.length >= limit) break; if (!selected.includes(item)) selected.push(item) }
  const inputHash = hash(JSON.stringify({ ...input, now: undefined, weights })).toString(16)
  return { id: `rec_${hash(`${seed}:${slot}:${generatedAt.toISOString().slice(0, 13)}`).toString(16)}`, slot, seed, algorithmVersion: ALGORITHM_VERSION, generatedAt: generatedAt.toISOString(), expiresAt: new Date(generatedAt.getTime() + 15 * 60_000).toISOString(), inputHash, recommendations: selected, diagnostics: { candidates: scored.length, filtered: catalog.products.length - scored.length, explorationCount: selected.filter((item) => item.explored).length, weights } }
}

function sourcePriority(source: CandidateSource, input: RecommendationInput) {
  const base: Record<CandidateSource, number> = { similar: 11, favorites: 10, history: 9, price_drop: 8, category: 7, trending: 6, editorial: 5, high_rating: 4, co_click: 3, co_visit: 2, new_products: 1 }
  return base[source] + (input.productId && source === 'similar' ? 5 : 0)
}

export function assignExperiment(experimentId: string, subjectId: string, variants = ['control', 'treatment']) {
  const index = hash(`${experimentId}:${subjectId}`) % variants.length
  return { experimentId, subjectId, variant: variants[index], assignmentId: `assign_${hash(`${experimentId}:${subjectId}`).toString(16)}`, sticky: true }
}

export function updateInterestProfile(current: Record<string, number>, action: 'impression' | 'view' | 'favorite' | 'affiliate_click' | 'conversion', category: string, daysAgo = 0) {
  const intensity = { impression: .03, view: .1, favorite: .28, affiliate_click: .34, conversion: .55 }[action]
  const decay = Math.exp(-Math.max(0, daysAgo) / 14)
  return { ...current, [category]: clamp((current[category] ?? 0) * .82 + intensity * decay) }
}
