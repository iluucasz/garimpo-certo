import type { Offer, Product } from '@/lib/types'

export const catalogSignals = ['Mais vendidos', 'Bem avaliados', 'Em promoção', 'Bom custo-benefício'] as const
export type CatalogSignal = (typeof catalogSignals)[number]

/** Preço atual: a menor oferta disponível; sem oferta, o último ponto do histórico. */
export function currentPrice(product: Product, offers: Offer[]) {
  const prices = offers.filter((offer) => offer.productId === product.id && offer.stock !== 'indisponível').map((offer) => offer.price)
  if (prices.length) return Math.min(...prices)
  return product.priceHistory.at(-1)?.price ?? 0
}

export function offerDiscount(offer?: Offer) {
  return offer?.previousPrice && offer.previousPrice > offer.price ? 1 - offer.price / offer.previousPrice : 0
}

/** Mesmos critérios usados pelos filtros de /buscar e pelos atalhos da home, para as contagens nunca divergirem. */
export function matchesSignal(signal: string, product: Product, offers: Offer[]) {
  const productOffers = offers.filter((offer) => offer.productId === product.id)
  const best = productOffers.slice().sort((a, b) => a.price - b.price)[0]
  const sold = Math.max(0, ...productOffers.map((offer) => offer.soldCount ?? 0))
  const price = currentPrice(product, offers)
  if (signal === 'Mais vendidos') return sold >= 1000
  if (signal === 'Bem avaliados') return product.rating >= 4.8
  if (signal === 'Em promoção') return offerDiscount(best) >= 0.2 || product.tags.includes('Em promoção')
  if (signal === 'Bom custo-benefício') return product.score >= 85 && price <= 1500
  return true
}
