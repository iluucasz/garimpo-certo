import { describe, expect, it } from 'vitest'
import { assignVariant, bucketOf, compare, experimentTag, MIN_PER_VARIANT, normalCdf, normalizeVariantB, slugifyKey } from '@/lib/experiments/core'

describe('sorteio da variante', () => {
  it('é estável: o mesmo visitante cai sempre na mesma variante', () => {
    for (const id of ['a', 'b', 'c', crypto.randomUUID()]) {
      expect(assignVariant(id, 'topo', 50)).toBe(assignVariant(id, 'topo', 50))
      expect(bucketOf(id, 'topo')).toBeGreaterThanOrEqual(0)
      expect(bucketOf(id, 'topo')).toBeLessThan(100)
    }
  })

  it('respeita a divisão de tráfego', () => {
    const ids = Array.from({ length: 4000 }, (_, index) => `visitante-${index}`)
    const share = (split: number) => ids.filter((id) => assignVariant(id, 'teste', split) === 'b').length / ids.length
    expect(share(50)).toBeGreaterThan(0.46)
    expect(share(50)).toBeLessThan(0.54)
    expect(share(10)).toBeGreaterThan(0.07)
    expect(share(10)).toBeLessThan(0.13)
    expect(share(0)).toBe(0)
    expect(share(100)).toBe(1)
  })

  it('testes diferentes sorteiam de forma independente', () => {
    const ids = Array.from({ length: 2000 }, (_, index) => `v-${index}`)
    const same = ids.filter((id) => assignVariant(id, 'um', 50) === assignVariant(id, 'dois', 50)).length / ids.length
    expect(same).toBeGreaterThan(0.45)
    expect(same).toBeLessThan(0.55)
  })

  it('a etiqueta do clique junta teste e variante', () => {
    expect(experimentTag('topo-abril', 'b')).toBe('topo-abril-b')
    expect(slugifyKey('Topo da Home — Abril!')).toBe('topo-da-home-abril')
  })
})

describe('textos da variante B', () => {
  it('limpa espaços, limita o tamanho e exige algum texto', () => {
    expect(normalizeVariantB({ title: '  Achados   do dia ', accent: '' })).toEqual({ value: { title: 'Achados do dia' } })
    expect(normalizeVariantB({})).toHaveProperty('errors.title')
    expect(normalizeVariantB({ title: 'x'.repeat(41) })).toHaveProperty('errors.title')
    expect(normalizeVariantB({ buttonLabel: 'y'.repeat(25) })).toHaveProperty('errors.buttonLabel')
    expect(normalizeVariantB('texto')).toHaveProperty('errors')
  })
})

describe('comparação estatística', () => {
  it('a distribuição normal bate com valores conhecidos', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3)
  })

  it('com poucas exposições não dá veredito, mesmo com diferença grande', () => {
    const result = compare({ exposed: 50, converted: 2 }, { exposed: 50, converted: 10 })
    expect(result.verdict).toBe('insufficient')
    expect(result.missing).toEqual({ a: MIN_PER_VARIANT - 50, b: MIN_PER_VARIANT - 50 })
  })

  it('reconhece uma melhora real com amostra suficiente', () => {
    const result = compare({ exposed: 1000, converted: 50 }, { exposed: 1000, converted: 90 })
    expect(result.verdict).toBe('b_better')
    expect(result.diffPoints).toBeCloseTo(4, 5)
    expect(result.pValue).toBeLessThan(0.01)
    expect(result.ciLow).toBeGreaterThan(0)
  })

  it('reconhece piora e ausência de diferença', () => {
    expect(compare({ exposed: 1000, converted: 120 }, { exposed: 1000, converted: 60 }).verdict).toBe('a_better')
    const flat = compare({ exposed: 500, converted: 25 }, { exposed: 500, converted: 27 })
    expect(flat.verdict).toBe('no_difference')
    expect(flat.ciLow).toBeLessThan(0)
    expect(flat.ciHigh).toBeGreaterThan(0)
  })

  it('não quebra sem dados', () => {
    const result = compare({ exposed: 0, converted: 0 }, { exposed: 0, converted: 0 })
    expect(result.verdict).toBe('insufficient')
    expect(result.pValue).toBe(1)
    expect(Number.isFinite(result.rateA)).toBe(true)
  })
})
