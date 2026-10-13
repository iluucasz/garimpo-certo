import { describe, expect, it } from 'vitest'
import { buildCollections, collectionSlugsFor } from '@/lib/catalog/collections'
import { buildGuide, guideSlugs } from '@/lib/catalog/guides'
import type { Category, Offer, Product } from '@/lib/types'

const product = (id: string, category: string, rating: number, score = 80): Product => ({
  id, slug: `p-${id}`, name: `Produto ${id}`, brand: 'Loja', category, description: '', longDescription: '', image: '/x.jpg', images: [],
  rating, reviews: 0, score, growth: 0, tags: [], specs: {}, priceHistory: [],
})
const offer = (productId: string, price: number, soldCount: number, previousPrice?: number): Offer => ({
  id: `o-${productId}`, productId, providerId: 'shopee', price, previousPrice, shipping: 0, installment: '', stock: 'disponível', url: 'https://shopee.example/x', updatedAt: 'agora', soldCount,
})

const products = [
  product('1', 'casa', 4.9, 90), product('2', 'casa', 4.8, 85), product('3', 'casa', 4.2, 70),
  product('4', 'casa', 4.9, 60), product('5', 'audio', 4.7, 50), product('6', 'audio', 4.0, 40),
]
const offers = [
  offer('1', 30, 5000, 60), offer('2', 45, 2500, 50), offer('3', 120, 80), offer('4', 20, 1200, 21),
  offer('5', 300, 10), offer('6', 80, 3),
]
const categories: Category[] = [
  { id: 'c1', name: 'Casa', slug: 'casa', icon: '', description: '' },
  { id: 'c2', name: 'Áudio', slug: 'audio', icon: '', description: '' },
]

describe('coleções derivadas do catálogo', () => {
  it('só aparecem com produtos suficientes e ordenadas pelo critério', () => {
    const collections = buildCollections({ products, offers })
    const bySlug = Object.fromEntries(collections.map((collection) => [collection.slug, collection]))

    expect(bySlug['mais-vendidos'].products.map((item) => item.id)).toEqual(['1', '2', '4'])
    expect(bySlug['ate-50'].products.map((item) => item.id).sort()).toEqual(['1', '2', '4'])
    expect(bySlug['bem-avaliados'].products.map((item) => item.id)).toEqual(['1', '4', '2'])
    // Em promoção exige 3+: apenas 1 (50%) e 2 (10% de desconto não basta); sem massa suficiente a coleção some.
    expect(bySlug['em-promocao']).toBeUndefined()
  })

  it('a descrição fala a contagem real', () => {
    const collection = buildCollections({ products, offers }).find((item) => item.slug === 'mais-vendidos')!
    expect(collection.description).toMatch(/^3 produtos/)
  })

  it('expõe só os slugs que existem hoje, incluindo as coleções por categoria', () => {
    const slugs = collectionSlugsFor({ products, offers, categories })
    expect(slugs).toContain('mais-vendidos')
    expect(slugs).toContain('mais-vendidos-casa')
    expect(slugs).not.toContain('virais-do-tiktok')
  })

  it('coleção de curadoria só aparece com pelo menos 3 itens ativos no catálogo', () => {
    const base = { products, offers, categories }
    expect(buildCollections(base).some((collection) => collection.slug === 'virais-do-tiktok')).toBe(false)
  })

  it('"Viralizou" usa o limiar de 10 mil vendas e "Achadinhos" combina preço, nota e vendas', () => {
    const many = [
      ...products,
      product('7', 'casa', 4.9, 70), product('8', 'casa', 4.8, 70), product('9', 'casa', 4.7, 70),
    ]
    const manyOffers = [...offers, offer('7', 25, 15000), offer('8', 29, 12000), offer('9', 10, 11000)]
    const collections = buildCollections({ products: many, offers: manyOffers, categories })
    const viral = collections.find((collection) => collection.slug === 'viralizou')!
    expect(viral.products.map((item) => item.id)).toEqual(['7', '8', '9'])
    const finds = collections.find((collection) => collection.slug === 'achadinhos')!
    expect(finds.products.every((item) => item.rating >= 4.7)).toBe(true)
  })
})

describe('guias de compra por categoria', () => {
  it('exige 3 produtos e calcula a faixa de preço e os destaques', () => {
    expect(guideSlugs({ products, offers, categories })).toEqual(['casa'])
    expect(buildGuide({ products, offers, categories }, 'audio')).toBeNull()

    const guide = buildGuide({ products, offers, categories }, 'casa')!
    expect(guide.count).toBe(4)
    expect(guide.stats.minPrice).toBe(20)
    expect(guide.stats.maxPrice).toBe(120)
    expect(guide.stats.medianPrice).toBe(37.5)
    expect(guide.stats.topSeller?.product.id).toBe('1')
    expect(guide.checks.length).toBeGreaterThan(0)
  })

  it('não repete produto e não dá rótulo a quem não o merece', () => {
    const guide = buildGuide({ products, offers, categories }, 'casa')!
    const ids = guide.picks.map((pick) => pick.product.id)
    expect(new Set(ids).size).toBe(ids.length)

    const labelsOf = (id: string) => guide.picks.find((pick) => pick.product.id === id)?.label ?? ''
    // O produto 1 vence vendas, nota (empata com o 4 e desempata por vendas) e desconto: um card, três rótulos.
    expect(labelsOf('1')).toBe('Mais vendido · Melhor avaliado · Maior desconto')
    // O produto 4 só é o mais barato: recebe só esse rótulo.
    expect(labelsOf('4')).toBe('Mais em conta')
    expect(guide.picks.flatMap((pick) => pick.label.split(' · ')).filter((label) => label === 'Mais em conta')).toHaveLength(1)
  })

  it('categoria inexistente não gera guia', () => {
    expect(buildGuide({ products, offers, categories }, 'nao-existe')).toBeNull()
  })
})
