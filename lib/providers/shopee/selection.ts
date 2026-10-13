import { slugify } from './mapping'
import type { ShopeeProductOffer } from './client'

/**
 * Seleção do catálogo por categoria.
 *
 * Ordenar só por vendas premia o que é barato: acessórios de R$ 5 vendem milhares de unidades e ocupam
 * tudo. Aqui cada categoria é dividida em faixas de preço com cota própria, para a vitrine ter
 * os mais vendidos *de cada faixa* (de um grip de controle a um console).
 *
 * Em cada faixa o corte de qualidade continua obrigatório (nota mínima e vendas mínimas). Nas faixas de
 * valor alto, a ordem é "vendas x comissão por venda": o que mais vende e mais paga ao afiliado entre os
 * itens que já passaram no corte de qualidade. O Índice Garimpo exibido ao visitante não usa comissão.
 */

export type TierId = 'essencial' | 'intermediario' | 'premium'

export const tierBounds = { intermediario: 100, premium: 500 } as const

export const tierOf = (price: number): TierId => (price >= tierBounds.premium ? 'premium' : price >= tierBounds.intermediario ? 'intermediario' : 'essencial')

export const tierLabels: Record<TierId, string> = {
  essencial: `até R$ ${tierBounds.intermediario - 1}`,
  intermediario: `R$ ${tierBounds.intermediario} a R$ ${tierBounds.premium - 1}`,
  premium: `a partir de R$ ${tierBounds.premium}`,
}

export type TierMix = Record<TierId, number>
/** Categorias de itens de uso comum: maioria acessível, com espaço para opções melhores. */
export const defaultMix: TierMix = { essencial: 0.4, intermediario: 0.35, premium: 0.25 }
/** Categorias em que o produto principal é caro (consoles, TVs, eletrodomésticos). */
export const highTicketMix: TierMix = { essencial: 0.15, intermediario: 0.35, premium: 0.5 }

export type Candidate = { offer: ShopeeProductOffer; source: string }

export type SelectionOptions = {
  perCategory: number
  mix: TierMix
  minRating: number
  /** Itens caros vendem menos unidades; o corte de vendas é menor nas faixas altas. */
  minSales: TierMix
  maxPerShop: number
}

export type SelectionState = { seen: Set<string>; perShop: Map<number, number> }

const priceOf = (offer: ShopeeProductOffer) => Number(offer.priceMin) || Number(offer.price) || 0
const salesOf = (offer: ShopeeProductOffer) => Math.max(0, Number(offer.sales) || 0)
const commissionOf = (offer: ShopeeProductOffer) => {
  const stated = Number(offer.commission)
  if (Number.isFinite(stated) && stated > 0) return stated
  return priceOf(offer) * (Number(offer.commissionRate) || 0)
}
/** Chave para não repetir o mesmo produto anunciado por várias lojas na mesma categoria. */
export const nameKey = (name: string) => slugify(name).slice(0, 42)

/** Valor da posição dentro da faixa: vendas na faixa básica; vendas x comissão nas faixas de valor. */
export function tierRank(offer: ShopeeProductOffer, tier: TierId) {
  const sales = salesOf(offer)
  return tier === 'essencial' ? sales : sales * Math.max(commissionOf(offer), 0.01)
}

function slotsFor(perCategory: number, mix: TierMix): TierMix {
  const raw = (Object.keys(mix) as TierId[]).map((tier) => ({ tier, exact: perCategory * mix[tier] }))
  const slots = Object.fromEntries(raw.map((item) => [item.tier, Math.floor(item.exact)])) as TierMix
  let remaining = perCategory - Object.values(slots).reduce((sum, value) => sum + value, 0)
  // Sobras vão para as faixas com maior parte fracionária.
  for (const item of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (remaining <= 0) break
    slots[item.tier] += 1
    remaining -= 1
  }
  return slots
}

export type CategorySelection = {
  offers: ShopeeProductOffer[]
  analyzed: number
  byTier: TierMix
  eligibleByTier: TierMix
}

/** Escolhe até `perCategory` ofertas da categoria, atualizando `state` (itens vistos e cota por loja). */
export function selectForCategory(candidates: Candidate[], options: SelectionOptions, state: SelectionState): CategorySelection {
  const usable = candidates.filter(({ offer }) => Boolean(offer.imageUrl) && Boolean(offer.offerLink) && priceOf(offer) > 0 && !state.seen.has(String(offer.itemId)))
  const byItem = new Map<string, Candidate & { tier: TierId }>()
  for (const candidate of usable) {
    const tier = tierOf(priceOf(candidate.offer))
    const rating = Number(candidate.offer.ratingStar) || 0
    if (rating < options.minRating || salesOf(candidate.offer) < options.minSales[tier]) continue
    const id = String(candidate.offer.itemId)
    if (!byItem.has(id)) byItem.set(id, { ...candidate, tier })
  }
  const eligible = [...byItem.values()]
  const eligibleByTier: TierMix = { essencial: 0, intermediario: 0, premium: 0 }
  for (const item of eligible) eligibleByTier[item.tier] += 1

  const chosen: (Candidate & { tier: TierId })[] = []
  const keys = new Set<string>()
  const perSource = new Map<string, number>()
  const perShop = state.perShop
  const slots = slotsFor(options.perCategory, options.mix)
  const byTier: TierMix = { essencial: 0, intermediario: 0, premium: 0 }

  const take = (item: Candidate & { tier: TierId }, respectSourceCap: number | null) => {
    const key = nameKey(item.offer.productName)
    if (keys.has(key)) return false
    if ((perShop.get(item.offer.shopId) ?? 0) >= options.maxPerShop) return false
    const bucket = `${item.tier}:${item.source}`
    if (respectSourceCap !== null && (perSource.get(bucket) ?? 0) >= respectSourceCap) return false
    chosen.push(item)
    keys.add(key)
    perShop.set(item.offer.shopId, (perShop.get(item.offer.shopId) ?? 0) + 1)
    perSource.set(bucket, (perSource.get(bucket) ?? 0) + 1)
    byTier[item.tier] += 1
    return true
  }

  const tiers: TierId[] = ['premium', 'intermediario', 'essencial']
  const ranked = Object.fromEntries(tiers.map((tier) => [tier, eligible.filter((item) => item.tier === tier).sort((a, b) => tierRank(b.offer, tier) - tierRank(a.offer, tier))])) as Record<TierId, typeof eligible>

  // 1ª passada: cota de cada faixa, sem deixar uma única busca tomar a faixa inteira (diversidade).
  for (const tier of tiers) {
    const cap = Math.max(2, Math.ceil(slots[tier] / 3))
    for (const item of ranked[tier]) {
      if (byTier[tier] >= slots[tier]) break
      take(item, cap)
    }
  }
  // 2ª passada: se a faixa não encheu por causa do limite por busca, relaxa o limite dentro da própria faixa.
  for (const tier of tiers) {
    for (const item of ranked[tier]) {
      if (byTier[tier] >= slots[tier]) break
      if (!chosen.includes(item)) take(item, null)
    }
  }
  // 3ª passada: faixas que não encheram (poucos itens bons) são completadas pelo que mais vende.
  if (chosen.length < options.perCategory) {
    const taken = new Set(chosen.map((item) => String(item.offer.itemId)))
    const rest = eligible.filter((item) => !taken.has(String(item.offer.itemId))).sort((a, b) => salesOf(b.offer) - salesOf(a.offer))
    for (const item of rest) {
      if (chosen.length >= options.perCategory) break
      take(item, null)
    }
  }

  for (const item of chosen) state.seen.add(String(item.offer.itemId))
  return { offers: chosen.map((item) => item.offer), analyzed: candidates.length, byTier, eligibleByTier }
}
