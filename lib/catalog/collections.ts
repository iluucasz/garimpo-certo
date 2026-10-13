import type { Offer, Product } from '@/lib/types'
import { currentPrice, matchesSignal, offerDiscount } from './signals'

export type CatalogInput = { products: Product[]; offers: Offer[] }

export type Collection = {
  slug: string
  title: string
  /** Frase curta que resume a ideia da seleção. */
  tone: string
  description: string
  products: Product[]
}

type Definition = {
  slug: string
  title: string
  tone: string
  /** Sinal compartilhado com os filtros de /buscar, ou um filtro próprio. */
  matches: (product: Product, input: CatalogInput) => boolean
  sort: (a: Product, b: Product, input: CatalogInput) => number
  describe: (count: number) => string
}

const soldOf = (product: Product, offers: Offer[]) => Math.max(0, ...offers.filter((offer) => offer.productId === product.id).map((offer) => offer.soldCount ?? 0))
const bestOffer = (product: Product, offers: Offer[]) => offers.filter((offer) => offer.productId === product.id).sort((a, b) => a.price - b.price)[0]

export const MAX_BUDGET = 50

const definitions: Definition[] = [
  {
    slug: 'mais-vendidos',
    title: 'Mais vendidos',
    tone: 'O que mais sai na Shopee',
    matches: (product, { offers }) => matchesSignal('Mais vendidos', product, offers),
    sort: (a, b, { offers }) => soldOf(b, offers) - soldOf(a, offers),
    describe: (count) => `${count} ${count === 1 ? 'produto com' : 'produtos com'} mais de mil vendas recentes informadas pela Shopee, dos mais vendidos para os menos.`,
  },
  {
    slug: 'em-promocao',
    title: 'Em promoção',
    tone: 'O preço caiu',
    matches: (product, { offers }) => matchesSignal('Em promoção', product, offers),
    sort: (a, b, { offers }) => offerDiscount(bestOffer(b, offers)) - offerDiscount(bestOffer(a, offers)),
    describe: (count) => `${count} ${count === 1 ? 'produto com' : 'produtos com'} 20% ou mais abaixo do preço anterior informado pela Shopee, do maior para o menor desconto.`,
  },
  {
    slug: 'bem-avaliados',
    title: 'Bem avaliados',
    tone: 'Nota 4,8 ou mais',
    matches: (product, { offers }) => matchesSignal('Bem avaliados', product, offers),
    sort: (a, b, { offers }) => b.rating - a.rating || soldOf(b, offers) - soldOf(a, offers),
    describe: (count) => `${count} ${count === 1 ? 'produto com' : 'produtos com'} nota média 4,8 ou mais, desempatados pelo volume de vendas.`,
  },
  {
    slug: 'ate-50',
    title: 'Até R$ 50',
    tone: 'Cabe no bolso',
    matches: (product, { offers }) => currentPrice(product, offers) <= MAX_BUDGET,
    sort: (a, b) => b.score - a.score,
    describe: (count) => `${count} ${count === 1 ? 'produto com' : 'produtos com'} preço atual de até R$ ${MAX_BUDGET}, ordenados pelo Índice Garimpo (avaliação, vendas e desconto).`,
  },
]

export const collectionSlugs = definitions.map((definition) => definition.slug)

/** Coleções calculadas na hora a partir do catálogo; as que ficam com menos de `minimum` produtos não aparecem. */
export function buildCollections(input: CatalogInput, minimum = 3, limit = 24): Collection[] {
  return definitions.flatMap((definition) => {
    const matching = input.products.filter((product) => definition.matches(product, input))
    if (matching.length < minimum) return []
    const sorted = [...matching].sort((a, b) => definition.sort(a, b, input))
    return [{
      slug: definition.slug,
      title: definition.title,
      tone: definition.tone,
      description: definition.describe(matching.length),
      products: sorted.slice(0, limit),
    }]
  })
}

export function findCollection(input: CatalogInput, slug: string) {
  return buildCollections(input).find((collection) => collection.slug === slug)
}
