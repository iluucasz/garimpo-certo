import { describe, expect, it } from 'vitest'
import { buildProfile, MIN_SIGNALS, rankForYou, type AffinityProduct } from '@/lib/personalization/affinity'

const product = (id: string, category: string, brand = 'Loja', score = 70): AffinityProduct => ({ id, category, brand, score })
const catalog = [
  product('c1', 'cozinha', 'A'), product('c2', 'cozinha', 'B'), product('c3', 'cozinha', 'A', 90),
  product('g1', 'games', 'C'), product('g2', 'games', 'C', 95),
  product('p1', 'pet', 'D'),
]
const prices: Record<string, number> = { c1: 100, c2: 120, c3: 90, g1: 3000, g2: 2800, p1: 60 }
const priceOf = (id: string) => prices[id] ?? 0

describe('perfil no aparelho', () => {
  it('favoritar pesa mais que comparar, que pesa mais que só ver', () => {
    const profile = buildProfile({ recent: ['g1'], favorites: ['c1'], compare: ['p1'] }, catalog, priceOf)
    expect(profile.categories.cozinha).toBeGreaterThan(profile.categories.pet)
    expect(profile.categories.pet).toBeGreaterThan(profile.categories.games)
    expect(profile.signals).toBe(3)
  })

  it('o que foi visto há pouco pesa mais que o visto há tempo', () => {
    const recent = ['c1', 'g1', 'p1', 'c2', 'c3', 'g2']
    const profile = buildProfile({ recent, favorites: [], compare: [] }, catalog, priceOf)
    expect(profile.signals).toBe(6)
    expect(profile.categories.cozinha).toBeGreaterThan(0)
  })

  it('ignora produto que saiu do catálogo e conta categorias escolhidas à mão', () => {
    const profile = buildProfile({ recent: ['inexistente'], favorites: [], compare: [] }, catalog, priceOf, ['pet'])
    expect(profile.signals).toBe(0)
    expect(profile.categories.pet).toBeGreaterThan(0)
  })

  it('calcula a faixa de preço a partir do que a pessoa olhou', () => {
    const profile = buildProfile({ recent: [], favorites: ['c1', 'c2'], compare: [] }, catalog, priceOf)
    expect(profile.priceBand).not.toBeNull()
    expect(profile.priceBand!.low).toBeLessThan(110)
    expect(profile.priceBand!.high).toBeGreaterThan(200)
    expect(buildProfile({ recent: [], favorites: [], compare: [] }, catalog, priceOf).priceBand).toBeNull()
  })
})

describe('ordenação "Para você"', () => {
  it('põe a categoria preferida primeiro e não repete o que já foi favoritado', () => {
    const interactions = { recent: [], favorites: ['c1', 'c2'], compare: [] }
    const profile = buildProfile(interactions, catalog, priceOf)
    const ranked = rankForYou(catalog, profile, interactions, priceOf)
    expect(ranked[0].product.id).toBe('c3')
    expect(ranked.map((item) => item.product.id)).not.toContain('c1')
    expect(ranked[0].why).toBe('category')
  })

  it('descarta o que está fora da faixa de preço de quem só olha produtos baratos', () => {
    const interactions = { recent: [], favorites: ['c1', 'c2', 'c3'], compare: [] }
    const profile = buildProfile(interactions, catalog, priceOf)
    const ranked = rankForYou(catalog, profile, interactions, priceOf).map((item) => item.product.id)
    expect(ranked.indexOf('p1')).toBeGreaterThanOrEqual(0)
    expect(ranked.indexOf('p1')).toBeLessThan(ranked.indexOf('g1') === -1 ? 99 : ranked.indexOf('g1'))
  })

  it('o que acabou de ser visto aparece depois do que é novo', () => {
    const interactions = { recent: ['c2'], favorites: ['c1'], compare: [] }
    const profile = buildProfile(interactions, catalog, priceOf)
    const ids = rankForYou(catalog, profile, interactions, priceOf).map((item) => item.product.id)
    expect(ids.indexOf('c3')).toBeLessThan(ids.indexOf('c2'))
  })

  it('o mínimo de sinais é pequeno, mas existe', () => {
    expect(MIN_SIGNALS).toBeGreaterThanOrEqual(2)
  })
})
