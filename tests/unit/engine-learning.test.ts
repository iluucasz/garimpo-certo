import { describe, expect, it } from 'vitest'
import { categoryBoosts, categoryPerformance, defaultEngineConfig, quotaProposals, type CategoryStat } from '@/lib/engine/rules'
import { rankCandidates, type PostCandidate } from '@/lib/social/picker'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const stat = (slug: string, patch: Partial<CategoryStat> = {}): CategoryStat => ({ slug, name: slug.toUpperCase(), products: 40, views: 0, clicks: 0, conversions: 0, ...patch })

describe('aprender com os cliques', () => {
  it('compara cada categoria com o tamanho dela', () => {
    const { totalClicks, categories } = categoryPerformance([stat('a', { clicks: 60 }), stat('b', { clicks: 20 }), stat('c', { clicks: 20, products: 80 })])
    expect(totalClicks).toBe(100)
    // a: 60% dos cliques com 25% dos produtos = 2,4×; c: 20% com 50% = 0,4×
    expect(categories[0].slug).toBe('a')
    expect(categories[0].ratio).toBeCloseTo(2.4)
    expect(categories.at(-1)?.ratio).toBeCloseTo(0.4)
  })

  it('não aprende com poucos cliques', () => {
    const result = quotaProposals([stat('a', { clicks: 30 }), stat('b', { clicks: 1 })], defaultEngineConfig, NOW)
    expect(result.proposals).toEqual([])
    expect(result.note).toMatch(/Poucos cliques/)
    expect(categoryBoosts([stat('a', { clicks: 30 }), stat('b', { clicks: 1 })], defaultEngineConfig)).toEqual({})
  })

  it('pede mais produtos só para quem rende bem acima da média', () => {
    const stats = [stat('games', { clicks: 90, conversions: 3 }), stat('casa', { clicks: 25 }), stat('pet', { clicks: 5 }), stat('beleza', { clicks: 0 })]
    const result = quotaProposals(stats, defaultEngineConfig, NOW)
    expect(result.proposals.map((item) => item.subjectId)).toContain('games')
    expect(result.proposals.map((item) => item.subjectId)).not.toContain('beleza')
    const games = result.proposals.find((item) => item.subjectId === 'games')!
    expect(games.kind).toBe('category_quota')
    expect(games.payload).toMatchObject({ category: 'games', extra: defaultEngineConfig.quotaExtra })
    expect(String(games.payload.until)).toBe('2026-11-13')
  })

  it('o reforço das postagens fica entre 1 e 1,25 e só vale com dados', () => {
    const boosts = categoryBoosts([stat('games', { clicks: 150 }), stat('casa', { clicks: 5 }), stat('pet', { clicks: 5 })], defaultEngineConfig)
    expect(boosts.games).toBeGreaterThan(1)
    expect(boosts.games).toBeLessThanOrEqual(1.25)
    expect(boosts.casa).toBeUndefined()
    expect(categoryBoosts([stat('games', { clicks: 150 })], { ...defaultEngineConfig, learnEnabled: false })).toEqual({})
  })

  it('desligado, não sugere nada', () => {
    const result = quotaProposals([stat('a', { clicks: 200 }), stat('b', { clicks: 1 })], { ...defaultEngineConfig, learnEnabled: false }, NOW)
    expect(result.proposals).toEqual([])
    expect(result.note).toBeNull()
  })
})

describe('escolha das postagens com reforço por categoria', () => {
  const candidate = (patch: Partial<PostCandidate>): PostCandidate => ({
    productId: crypto.randomUUID(), offerId: crypto.randomUUID(), name: 'Produto', slug: 'produto', imageUrl: 'https://x/y.jpg', category: 'casa',
    price: 100, originalPrice: null, discountPercent: null, rating: 4.8, soldCount: 500, editorialScore: 70, commissionRate: 0.05,
    priceDropPercent: 0, externalUrl: 'https://shopee.com.br/x', lastPostedAt: null, ...patch,
  })
  const options = { now: NOW, cooldownDays: 14, minRating: 4.5, minSold: 100, minPrice: 10, limit: 2, perCategory: 1 }

  it('uma categoria que rende passa à frente de uma levemente melhor', () => {
    const casa = candidate({ category: 'casa', editorialScore: 72 })
    const games = candidate({ category: 'games', editorialScore: 70 })
    expect(rankCandidates([casa, games], options)[0].candidate.category).toBe('casa')
    const boosted = rankCandidates([casa, games], { ...options, categoryBoost: { games: 1.2 } })
    expect(boosted[0].candidate.category).toBe('games')
    expect(boosted[0].reasons).toContain('categoria que mais gera cliques')
  })
})
