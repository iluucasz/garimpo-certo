import type { Category, Offer, Product } from '@/lib/types'
import { defaultCatalogRules, moneyLabel, ratingLabel, salesLabel, type CatalogRules } from './rules'
import { currentPrice, matchesSignal, offerDiscount, offersOf } from './signals'

export type CuratedDefinition = { slug: string; title: string; tone: string; description: string; productIds: string[] }
export type CatalogInput = { products: Product[]; offers: Offer[]; categories?: Category[]; curated?: CuratedDefinition[]; rules?: CatalogRules }

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
const soldOf = (product: Product, offers: Offer[]) => Math.max(0, ...offersOf(offers, product.id).map((offer) => offer.soldCount ?? 0))
const bestOffer = (product: Product, offers: Offer[]) => offersOf(offers, product.id).slice().sort((a, b) => a.price - b.price)[0]
const bySold = (a: Product, b: Product, { offers }: CatalogInput) => soldOf(b, offers) - soldOf(a, offers)
const byScore = (a: Product, b: Product) => b.score - a.score
const byDiscount = (a: Product, b: Product, { offers }: CatalogInput) => offerDiscount(bestOffer(b, offers)) - offerDiscount(bestOffer(a, offers))
const byRating = (a: Product, b: Product, input: CatalogInput) => b.rating - a.rating || bySold(a, b, input)

/** Teto do filtro "Até R$ 50" (o valor também aparece no slug da coleção, por isso não é editável). */
export const MAX_BUDGET = 50

/** Definições das coleções automáticas para um conjunto de regras; os textos acompanham os números das regras. */
function buildDefinitions(rules: CatalogRules): Definition[] {
  return [
    // ---- Em alta: tudo medido em vendas recentes informadas pela Shopee ----
    {
      slug: 'viralizou',
      title: 'Viralizou na Shopee',
      tone: 'Todo mundo comprando',
      group: 'Em alta',
      matches: (product, { offers }) => soldOf(product, offers) >= rules.viralSales,
      sort: bySold,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} mais de ${salesLabel(rules.viralSales)} vendas recentes informadas pela Shopee: o que está saindo em maior volume.`,
    },
    {
      slug: 'mais-vendidos',
      title: 'Mais vendidos',
      tone: 'O que mais sai na Shopee',
      group: 'Em alta',
      matches: (product, { offers }) => matchesSignal('Mais vendidos', product, offers, rules),
      sort: bySold,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} mais de ${salesLabel(rules.topSales)} vendas recentes informadas pela Shopee, dos mais vendidos para os menos.`,
    },
    {
      slug: 'queridinhos',
      title: 'Queridinhos',
      tone: 'Muito vendido e muito bem avaliado',
      group: 'Em alta',
      matches: (product, { offers }) => product.rating >= rules.lovedRating && soldOf(product, offers) >= rules.lovedSales,
      sort: bySold,
      describe: (count) => `${plural(count, 'produto que une', 'produtos que unem')} nota ${ratingLabel(rules.lovedRating)} ou mais a pelo menos ${salesLabel(rules.lovedSales)} vendas recentes.`,
    },
    {
      slug: 'achadinhos',
      title: `Achadinhos até ${moneyLabel(rules.findsPrice)}`,
      tone: 'Barato e aprovado',
      group: 'Em alta',
      matches: (product, { offers }) => currentPrice(product, offers) <= rules.findsPrice && product.rating >= rules.findsRating && soldOf(product, offers) >= rules.findsSales,
      sort: bySold,
      describe: (count) => `${plural(count, 'produto de', 'produtos de')} até ${moneyLabel(rules.findsPrice)}, com nota ${ratingLabel(rules.findsRating)} ou mais e pelo menos ${salesLabel(rules.findsSales)} vendas recentes.`,
    },
    // ---- Preço ----
    {
      slug: 'em-promocao',
      title: 'Em promoção',
      tone: 'O preço caiu',
      group: 'Preço',
      matches: (product, { offers }) => matchesSignal('Em promoção', product, offers, rules),
      sort: byDiscount,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} ${rules.promoDiscount}% ou mais abaixo do preço anterior informado pela Shopee, do maior para o menor desconto.`,
    },
    {
      slug: 'desconto-pesado',
      title: 'Desconto pesado',
      tone: 'Metade do preço, ou quase',
      group: 'Preço',
      matches: (product, { offers }) => offerDiscount(bestOffer(product, offers)) >= rules.heavyDiscount / 100,
      sort: byDiscount,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} ${rules.heavyDiscount}% ou mais abaixo do preço anterior informado pela Shopee.`,
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
    {
      slug: 'acima-de-500',
      title: 'Acima de R$ 500',
      tone: 'Para quem quer o produto principal',
      group: 'Preço',
      matches: (product, { offers }) => currentPrice(product, offers) >= rules.premiumPrice,
      sort: bySold,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} preço atual a partir de ${moneyLabel(rules.premiumPrice)}, dos mais vendidos para os menos: consoles, TVs, eletrodomésticos e outros itens de maior valor.`,
    },
    // ---- Qualidade ----
    {
      slug: 'bem-avaliados',
      title: 'Bem avaliados',
      tone: `Nota ${ratingLabel(rules.topRating)} ou mais`,
      group: 'Qualidade',
      matches: (product, { offers }) => matchesSignal('Bem avaliados', product, offers, rules),
      sort: byRating,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} nota média ${ratingLabel(rules.topRating)} ou mais, desempatados pelo volume de vendas.`,
    },
    {
      slug: 'custo-beneficio',
      title: 'Bom custo-benefício',
      tone: 'Nota alta, vendas e preço coerentes',
      group: 'Qualidade',
      matches: (product, { offers }) => matchesSignal('Bom custo-benefício', product, offers, rules),
      sort: byScore,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} Índice Garimpo ${rules.valueScore} ou mais e preço de até ${moneyLabel(rules.valuePriceMax)}, o mesmo critério do filtro “Bom custo-benefício” da busca.`,
    },
    {
      slug: 'nota-maxima',
      title: `Nota ${ratingLabel(rules.perfectRating)} ou mais`,
      tone: 'Quase sem defeito',
      group: 'Qualidade',
      matches: (product, { offers }) => product.rating >= rules.perfectRating && soldOf(product, offers) >= rules.findsSales,
      sort: byRating,
      describe: (count) => `${plural(count, 'produto com', 'produtos com')} nota média ${ratingLabel(rules.perfectRating)} ou mais e pelo menos ${salesLabel(rules.findsSales)} vendas recentes, para a nota ter peso.`,
    },
  ]
}

const categoryDefinition = (category: Category): Definition => ({
  slug: `mais-vendidos-${category.slug}`,
  title: `Mais vendidos em ${category.name}`,
  tone: category.name,
  group: 'Por categoria',
  matches: (product, { offers }) => product.category === category.slug && soldOf(product, offers) > 0,
  sort: bySold,
  describe: (count) => `${plural(count, 'produto', 'produtos')} de ${category.name.toLocaleLowerCase('pt-BR')} com mais vendas recentes na Shopee.`,
})

function curatedDefinitions(input: CatalogInput): Definition[] {
  return (input.curated ?? []).map((curated) => {
    const position = new Map(curated.productIds.map((id, index) => [id, index]))
    return {
      slug: curated.slug,
      title: curated.title,
      tone: curated.tone,
      group: 'Curadoria' as const,
      matches: (product: Product) => position.has(product.id),
      // A ordem é a que a equipe definiu no painel.
      sort: (a: Product, b: Product) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
      describe: () => curated.description,
    }
  })
}

/** Endereços que as coleções automáticas já usam; coleções manuais não podem reutilizá-los. */
export const isReservedCollectionSlug = (slug: string) => buildDefinitions(defaultCatalogRules).some((definition) => definition.slug === slug) || slug.startsWith('mais-vendidos-')

function allDefinitions(input: CatalogInput): Definition[] {
  const automatic = [...buildDefinitions(input.rules ?? defaultCatalogRules), ...(input.categories ?? []).map(categoryDefinition)]
  const taken = new Set(automatic.map((definition) => definition.slug))
  return [...automatic, ...curatedDefinitions(input).filter((definition) => !taken.has(definition.slug))]
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
