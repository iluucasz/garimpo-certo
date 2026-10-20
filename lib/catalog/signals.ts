import type { Offer, Product } from '@/lib/types'
import { defaultCatalogRules, type CatalogRules } from './rules'

export const catalogSignals = ['Mais vendidos', 'Bem avaliados', 'Em promoção', 'Bom custo-benefício'] as const
export type CatalogSignal = (typeof catalogSignals)[number]

const offersIndex = new WeakMap<Offer[], Map<string, Offer[]>>()
const noOffers: Offer[] = []

/**
 * Ofertas de um produto, na ordem original. O índice é montado uma vez por lista de ofertas: filtrar a lista inteira
 * a cada chamada (e os comparadores de `sort` chamam isso milhões de vezes) travava as páginas de coleção com o catálogo grande.
 * O resultado é compartilhado: quem precisar ordenar deve copiar antes.
 */
export function offersOf(offers: Offer[], productId: string): Offer[] {
  let index = offersIndex.get(offers)
  if (!index) {
    index = new Map()
    for (const offer of offers) {
      const list = index.get(offer.productId)
      if (list) list.push(offer)
      else index.set(offer.productId, [offer])
    }
    offersIndex.set(offers, index)
  }
  return index.get(productId) ?? noOffers
}

/** Preço atual: a menor oferta disponível; sem oferta, o último ponto do histórico. */
export function currentPrice(product: Product, offers: Offer[]) {
  const prices = offersOf(offers, product.id).filter((offer) => offer.stock !== 'indisponível').map((offer) => offer.price)
  if (prices.length) return Math.min(...prices)
  return product.priceHistory.at(-1)?.price ?? 0
}

export function offerDiscount(offer?: Offer) {
  return offer?.previousPrice && offer.previousPrice > offer.price ? 1 - offer.price / offer.previousPrice : 0
}

/** Mesmos critérios usados pelos filtros de /buscar e pelos atalhos da home, para as contagens nunca divergirem. */
export function matchesSignal(signal: string, product: Product, offers: Offer[], rules: CatalogRules = defaultCatalogRules) {
  const productOffers = offersOf(offers, product.id)
  const best = productOffers.slice().sort((a, b) => a.price - b.price)[0]
  const sold = Math.max(0, ...productOffers.map((offer) => offer.soldCount ?? 0))
  const price = currentPrice(product, offers)
  if (signal === 'Mais vendidos') return sold >= rules.topSales
  if (signal === 'Bem avaliados') return product.rating >= rules.topRating
  if (signal === 'Em promoção') return offerDiscount(best) >= rules.promoDiscount / 100 || product.tags.includes('Em promoção')
  if (signal === 'Bom custo-benefício') return product.score >= rules.valueScore && price <= rules.valuePriceMax
  return true
}
