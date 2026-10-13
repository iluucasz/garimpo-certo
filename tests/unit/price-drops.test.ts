import { describe, expect, it } from 'vitest'
import { computeDrop, computeDrops, onlyFavorites, withBaselines } from '@/lib/favorites/price-drops'

const at = '2026-10-01T12:00:00.000Z'

describe('queda de preço dos favoritos', () => {
  it('detecta queda real e calcula valor e porcentagem', () => {
    expect(computeDrop('a', { price: 100, at }, 80)).toEqual({ productId: 'a', from: 100, to: 80, amount: 20, percent: 20, since: at })
  })

  it('ignora oscilação pequena, aumento e dados ausentes', () => {
    expect(computeDrop('a', { price: 100, at }, 99.5)).toBeNull() // menos de R$ 1
    expect(computeDrop('a', { price: 1000, at }, 990)).toBeNull() // menos de 2%
    expect(computeDrop('a', { price: 100, at }, 120)).toBeNull()
    expect(computeDrop('a', undefined, 50)).toBeNull()
    expect(computeDrop('a', { price: 100, at }, 0)).toBeNull()
  })

  it('lista só os favoritos que caíram, do maior para o menor', () => {
    const baselines = { a: { price: 100, at }, b: { price: 200, at }, c: { price: 50, at }, fora: { price: 100, at } }
    const prices: Record<string, number> = { a: 90, b: 100, c: 60, fora: 10 }
    const drops = computeDrops(baselines, ['a', 'b', 'c'], (id) => prices[id])
    expect(drops.map((drop) => drop.productId)).toEqual(['b', 'a'])
  })

  it('a referência é a de quando salvou e nunca é sobrescrita', () => {
    const first = withBaselines({}, ['a'], () => 100, at)
    expect(first.a).toEqual({ price: 100, at })
    const again = withBaselines(first, ['a', 'b'], (id) => (id === 'a' ? 70 : 30), '2026-10-05T00:00:00.000Z')
    expect(again.a.price).toBe(100)
    expect(again.b).toEqual({ price: 30, at: '2026-10-05T00:00:00.000Z' })
  })

  it('não cria referência para produto sem preço e remove o que deixou de ser favorito', () => {
    expect(withBaselines({}, ['x'], () => 0)).toEqual({})
    expect(onlyFavorites({ a: { price: 1, at }, b: { price: 2, at } }, ['b'])).toEqual({ b: { price: 2, at } })
  })
})
