import type { Category, Offer, Product } from '@/lib/types'
import { curatedCollections } from './curated'
import { currentPrice, matchesSignal, offerDiscount } from './signals'

export type CatalogInput = { products: Product[]; offers: Offer[]; categories?: Category[] }

export type CollectionGroup = 'Em alta' | 'Preço' | 'Qualidade' | 'Por categoria' | 'Curadoria'
export const collectionGroups: CollectionGroup[] = ['Em alta', 'Preço', 'Qualidade', 'Por categoria', 'Curadoria']

export type Collection = {
  slug: string
  title: string
  /** Frase curta que resume a ideia da seleção. */
  tone: string
  description: string
  group: CollectionGroup
  /** Quantos produtos do catálogo atendem ao critério (pode passar de `products.length`). */
  total: number
  products: Product[]
}

type Definition = {
  slug: string
  title: string
  tone: string
  group: CollectionGroup
  matches: (product: Product, input: CatalogInput) => boolean
  sort: (a: Product, b: Product, input: CatalogInput) => number
  describe: (count: number) => string
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const soldOf = (product: Product, offers: Offer[]) => Math.max(0, ...offers.filter((offer) => offer.productId === product.id).map((offer) => offer.soldCount ?? 0))
const bestOffer = (product: Product, offers: Offer[]) => offers.filter((offer) => offer.productId === product.id).sort((a, b) => a.price - b.price)[0]
const bySold = (a: Product, b: Product, { offers }: CatalogInput) => soldOf(b, offers) - soldOf(a, offers)
const byScore = (a: Product, b: Product) => b.score - a.score
const byDiscount = (a: Product, b: Product, { offers }: CatalogInput) => offerDiscount(bestOffer(b, offers)) - offerDiscount(bestOffer(a, offers))
const byRating = (a: Product, b: Product, input: CatalogInput) => b.rating - a.rating || bySold(a, b, input)

/** Limiares usados nas descrições, para o texto nunca divergir da regra. */
export const MAX_BUDGET = 50
const VIRAL_SALES = 10_000
const LOVED_SALES = 1_000
const FINDS_PRICE = 30
const FINDS_SALES = 500
const HEAVY_DISCOUNT = 0.4

const definitions: Definition[] = [
  // ---- Em alta: tudo medido em vendas recentes informadas pela Shopee ----
  {
    slug: 'viralizou',
    title: 'Viralizou na Shopee',
    tone: 'Todo mundo comprando',
    group: 'Em alta',
    matches: (product, { offers }) => soldOf(product, offers) >= VIRAL_SALES,
    sort: bySold,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} mais de 10 mil vendas recentes informadas pela Shopee: o que está saindo em maior volume.`,
  },
  {
    slug: 'mais-vendidos',
    title: 'Mais vendidos',
    tone: 'O que mais sai na Shopee',
    group: 'Em alta',
    matches: (product, { offers }) => matchesSignal('Mais vendidos', product, offers),
    sort: bySold,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} mais de mil vendas recentes informadas pela Shopee, dos mais vendidos para os menos.`,
  },
  {
    slug: 'queridinhos',
    title: 'Queridinhos',
    tone: 'Muito vendido e muito bem avaliado',
    group: 'Em alta',
    matches: (product, { offers }) => product.rating >= 4.8 && soldOf(product, offers) >= LOVED_SALES,
    sort: bySold,
    describe: (count) => `${plural(count, 'produto que une', 'produtos que unem')} nota 4,8 ou mais a pelo menos mil vendas recentes.`,
  },
  {
    slug: 'achadinhos',
    title: 'Achadinhos até R$ 30',
    tone: 'Barato e aprovado',
    group: 'Em alta',
    matches: (product, { offers }) => currentPrice(product, offers) <= FINDS_PRICE && product.rating >= 4.7 && soldOf(product, offers) >= FINDS_SALES,
    sort: bySold,
    describe: (count) => `${plural(count, 'produto de', 'produtos de')} até R$ ${FINDS_PRICE}, com nota 4,7 ou mais e pelo menos ${FINDS_SALES} vendas recentes.`,
  },
  // ---- Preço ----
  {
    slug: 'em-promocao',
    title: 'Em promoção',
    tone: 'O preço caiu',
    group: 'Preço',
    matches: (product, { offers }) => matchesSignal('Em promoção', product, offers),
    sort: byDiscount,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} 20% ou mais abaixo do preço anterior informado pela Shopee, do maior para o menor desconto.`,
  },
  {
    slug: 'desconto-pesado',
    title: 'Desconto pesado',
    tone: 'Metade do preço, ou quase',
    group: 'Preço',
    matches: (product, { offers }) => offerDiscount(bestOffer(product, offers)) >= HEAVY_DISCOUNT,
    sort: byDiscount,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} 40% ou mais abaixo do preço anterior informado pela Shopee.`,
  },
  {
    slug: 'ate-20',
    title: 'Até R$ 20',
    tone: 'Para gastar quase nada',
    group: 'Preço',
    matches: (product, { offers }) => currentPrice(product, offers) <= 20,
    sort: byScore,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} preço atual de até R$ 20, ordenados pelo Índice Garimpo.`,
  },
  {
    slug: 'ate-50',
    title: 'Até R$ 50',
    tone: 'Cabe no bolso',
    group: 'Preço',
    matches: (product, { offers }) => currentPrice(product, offers) <= MAX_BUDGET,
    sort: byScore,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} preço atual de até R$ ${MAX_BUDGET}, ordenados pelo Índice Garimpo (avaliação, vendas e desconto).`,
  },
  {
    slug: 'ate-100',
    title: 'Até R$ 100',
    tone: 'Bom e ainda em conta',
    group: 'Preço',
    matches: (product, { offers }) => currentPrice(product, offers) <= 100,
    sort: byScore,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} preço atual de até R$ 100, ordenados pelo Índice Garimpo.`,
  },
  // ---- Qualidade ----
  {
    slug: 'bem-avaliados',
    title: 'Bem avaliados',
    tone: 'Nota 4,8 ou mais',
    group: 'Qualidade',
    matches: (product, { offers }) => matchesSignal('Bem avaliados', product, offers),
    sort: byRating,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} nota média 4,8 ou mais, desempatados pelo volume de vendas.`,
  },
  {
    slug: 'nota-maxima',
    title: 'Nota 4,9 ou mais',
    tone: 'Quase sem defeito',
    group: 'Qualidade',
    matches: (product, { offers }) => product.rating >= 4.9 && soldOf(product, offers) >= FINDS_SALES,
    sort: byRating,
    describe: (count) => `${plural(count, 'produto com', 'produtos com')} nota média 4,9 ou mais e pelo menos ${FINDS_SALES} vendas recentes, para a nota ter peso.`,
  },
]

const categoryDefinition = (category: Category): Definition => ({
  slug: `mais-vendidos-${category.slug}`,
  title: `Mais vendidos em ${category.name}`,
  tone: category.name,
  group: 'Por categoria',
  matches: (product, { offers }) => product.category === category.slug && soldOf(product, offers) > 0,
  sort: bySold,
  describe: (count) => `${plural(count, 'produto', 'produtos')} de ${category.name.toLocaleLowerCase('pt-BR')} com mais vendas recentes na Shopee.`,
})

function curatedDefinitions(): Definition[] {
  return curatedCollections.map((curated) => ({
    slug: curated.slug,
    title: curated.title,
    tone: curated.tone,
    group: 'Curadoria' as const,
    matches: (product: Product) => curated.itemIds.some((itemId) => product.slug.endsWith(`-${itemId}`)),
    sort: bySold,
    describe: () => curated.description,
  }))
}

function allDefinitions(input: CatalogInput): Definition[] {
  return [...definitions, ...(input.categories ?? []).map(categoryDefinition), ...curatedDefinitions()]
}

/** Coleções calculadas na hora a partir do catálogo; as que ficam com menos de `minimum` produtos não aparecem. */
export function buildCollections(input: CatalogInput, minimum = 3, limit = 120): Collection[] {
  return allDefinitions(input).flatMap((definition) => {
    const matching = input.products.filter((product) => definition.matches(product, input))
    if (matching.length < minimum) return []
    const sorted = [...matching].sort((a, b) => definition.sort(a, b, input))
    return [{
      slug: definition.slug,
      title: definition.title,
      tone: definition.tone,
      group: definition.group,
      description: definition.describe(matching.length),
      total: matching.length,
      products: sorted.slice(0, limit),
    }]
  })
}

/** Slugs que existem hoje no catálogo (para geração estática e sitemap). */
export function collectionSlugsFor(input: CatalogInput) {
  return buildCollections(input).map((collection) => collection.slug)
}

export function findCollection(input: CatalogInput, slug: string) {
  return buildCollections(input).find((collection) => collection.slug === slug)
}

/**
 * Capas para o índice: cada coleção mostra os primeiros produtos que ainda não apareceram como capa de uma
 * coleção anterior. Várias coleções "em alta" compartilham os mesmos campeões; assim as imagens variam sem
 * mudar o critério de nenhuma delas. Se faltar produto novo, completa com os da própria coleção.
 */
export function pickCovers(collections: Collection[], count = 3): Map<string, Product[]> {
  const used = new Set<string>()
  const covers = new Map<string, Product[]>()
  for (const collection of collections) {
    const fresh = collection.products.filter((product) => !used.has(product.id))
    const picked = [...fresh, ...collection.products.filter((product) => used.has(product.id))].slice(0, count)
    for (const product of picked) used.add(product.id)
    covers.set(collection.slug, picked)
  }
  return covers
}
