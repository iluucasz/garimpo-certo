import { describe, expect, it } from 'vitest'
import { assignExperiment, generateRecommendations, updateInterestProfile } from '@/lib/recommendation/engine'
import { buildCatalog, metricsFor } from '../helpers/catalog'

const catalog = buildCatalog()

describe('recommendation engine', () => {
  it('gera snapshot reproduzível com três estágios e diversidade', () => {
    const input = { seed: 'user-42', slot: 'home_for_you', limit: 6, interests: { audio: .9 }, now: new Date('2026-09-04T12:00:00Z') }
    const first = generateRecommendations(input, catalog)
    const second = generateRecommendations(input, catalog)
    expect(first.id).toBe(second.id)
    expect(first.recommendations.map((item) => item.product.id)).toEqual(second.recommendations.map((item) => item.product.id))
    expect(first.recommendations).toHaveLength(6)
    expect(Math.max(...Object.values(Object.fromEntries([...new Set(first.recommendations.map((item) => item.product.category))].map((category) => [category, first.recommendations.filter((item) => item.product.category === category).length]))))).toBeLessThanOrEqual(2)
    expect(first.recommendations.every((item) => item.sources.length > 0 && item.reasonCode)).toBe(true)
  })

  it('reserva exploração e não recomenda itens excluídos', () => {
    const result = generateRecommendations({ seed: 'new-user', limit: 5, exclude: ['1', '2'], explorationRate: .2 }, catalog)
    expect(result.recommendations.some((item) => item.explored)).toBe(true)
    expect(result.recommendations.some((item) => ['1', '2'].includes(item.product.id))).toBe(false)
  })

  it('usa engajamento medido em vez de estimativa quando há métricas', () => {
    const semMetricas = generateRecommendations({ seed: 'user-1', limit: 12, explorationRate: 0 }, catalog)
    const comMetricas = generateRecommendations({ seed: 'user-1', limit: 12, explorationRate: 0 }, { ...catalog, metrics: metricsFor('3', { views: 900, views24h: 120, views7d: 600, clicks: 180, clicks7d: 140, favorites: 60, conversions: 20 }) })
    const antes = semMetricas.recommendations.find((item) => item.product.id === '3')
    const depois = comMetricas.recommendations.find((item) => item.product.id === '3')
    expect(antes?.features.views ?? 0).toBe(0)
    expect(depois?.features.views).toBe(900)
    expect(depois!.features.ctr).toBeGreaterThan(antes!.features.ctr)
    expect(depois!.score).toBeGreaterThan(antes!.score)
  })

  it('sem catálogo não inventa recomendações', () => {
    const result = generateRecommendations({ seed: 'vazio', limit: 4 })
    expect(result.recommendations).toHaveLength(0)
    expect(result.diagnostics.candidates).toBe(0)
  })

  it('estima comissão pela taxa real da oferta', () => {
    const [primeiro] = generateRecommendations({ seed: 'comissao', limit: 12 }, catalog).recommendations
    const offer = catalog.offers.find((item) => item.productId === primeiro.product.id)!
    expect(primeiro.features.expectedCommission).toBeCloseTo(Math.min(1, offer.commissionRate! * offer.price / 25), 5)
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
