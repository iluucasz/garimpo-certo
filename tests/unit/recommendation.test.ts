import { describe, expect, it } from 'vitest'
import { assignExperiment, generateRecommendations, updateInterestProfile } from '@/lib/recommendation/engine'

describe('recommendation engine', () => {
  it('gera snapshot reproduzível com três estágios e diversidade', () => {
    const input = { seed: 'user-42', slot: 'home_for_you', limit: 6, interests: { audio: .9 }, now: new Date('2026-09-04T12:00:00Z') }
    const first = generateRecommendations(input)
    const second = generateRecommendations(input)
    expect(first.id).toBe(second.id)
    expect(first.recommendations.map((item) => item.product.id)).toEqual(second.recommendations.map((item) => item.product.id))
    expect(first.recommendations).toHaveLength(6)
    expect(Math.max(...Object.values(Object.fromEntries([...new Set(first.recommendations.map((item) => item.product.category))].map((category) => [category, first.recommendations.filter((item) => item.product.category === category).length]))))).toBeLessThanOrEqual(2)
    expect(first.recommendations.every((item) => item.sources.length > 0 && item.reasonCode)).toBe(true)
  })

  it('reserva exploração e não recomenda itens excluídos', () => {
    const result = generateRecommendations({ seed: 'new-user', limit: 5, exclude: ['1', '2'], explorationRate: .2 })
    expect(result.recommendations.some((item) => item.explored)).toBe(true)
    expect(result.recommendations.some((item) => ['1', '2'].includes(item.product.id))).toBe(false)
  })

  it('mantém assignment sticky', () => {
    expect(assignExperiment('hero-v2', 'session-9')).toEqual(assignExperiment('hero-v2', 'session-9'))
    expect(assignExperiment('hero-v2', 'session-9').sticky).toBe(true)
  })

  it('atualiza perfil com recência e intensidade', () => {
    const recent = updateInterestProfile({}, 'conversion', 'cozinha', 0)
    const old = updateInterestProfile({}, 'view', 'cozinha', 30)
    expect(recent.cozinha).toBeGreaterThan(old.cozinha)
  })
})
