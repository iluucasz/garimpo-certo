import { describe, expect, it } from 'vitest'
import { addDays, blackFriday, daysBetween, easterSunday, eventsFor, nthWeekday, upcomingEvents } from '@/lib/engine/calendar'
import { defaultEngineConfig, pruneProposals, seasonalProposals, type ProductSignal } from '@/lib/engine/rules'

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0)
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()
const signal = (patch: Partial<ProductSignal> = {}): ProductSignal => ({
  id: crypto.randomUUID(), name: 'Produto', slug: 'produto', createdAt: daysAgo(90), locked: false,
  views: 0, clicks: 0, favorites: 0, conversions: 0, soldCount: 100, ...patch,
})

describe('calendário comercial', () => {
  it('calcula datas móveis', () => {
    expect(easterSunday(2026)).toBe('2026-04-05')
    expect(easterSunday(2027)).toBe('2027-03-28')
    expect(nthWeekday(2026, 5, 0, 2)).toBe('2026-05-10') // Dia das Mães 2026
    expect(nthWeekday(2026, 8, 0, 2)).toBe('2026-08-09') // Dia dos Pais 2026
    expect(blackFriday(2026)).toBe('2026-11-27')
    expect(blackFriday(2025)).toBe('2025-11-28')
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
    expect(daysBetween('2026-10-13', '2026-11-27')).toBe(45)
  })

  it('o Carnaval cai 47 dias antes da Páscoa', () => {
    expect(eventsFor(2026).find((event) => event.id === 'carnaval')?.date).toBe('2026-02-17')
  })

  it('só abre a janela dentro da antecedência de cada data', () => {
    // 13/10/2026: Dia das Crianças (12/10) já passou; Black Friday (27/11) está a 45 dias, fora dos 28 de antecedência.
    const ids = upcomingEvents('2026-10-13', 60).map((event) => event.id)
    expect(ids).not.toContain('dia-das-criancas')
    expect(ids).not.toContain('black-friday')
    expect(ids).not.toContain('onze-onze') // 29 dias, e a antecedência do 11.11 é de 14
    expect(upcomingEvents('2026-10-30', 60).map((event) => event.id)).toContain('onze-onze')
    expect(upcomingEvents('2026-11-01', 60).map((event) => event.id)).toContain('black-friday')
  })

  it('vira o ano: em dezembro já enxerga eventos de janeiro/fevereiro do ano seguinte', () => {
    const ids = upcomingEvents('2026-12-28', 60).map((event) => event.id)
    expect(ids).toContain('volta-as-aulas')
  })

  it('cada evento tem termos e todos usam categorias do catálogo', () => {
    const categories = new Set(['tecnologia', 'casa', 'audio', 'cozinha', 'bem-estar', 'pet', 'beleza', 'fitness', 'games', 'eletronicos', 'eletrodomesticos'])
    for (const event of eventsFor(2026)) {
      expect(event.terms.length, event.id).toBeGreaterThan(0)
      for (const term of event.terms) expect(categories.has(term.category), `${event.id}:${term.category}`).toBe(true)
    }
  })
})

describe('faxina do catálogo', () => {
  const config = defaultEngineConfig

  it('sem tráfego suficiente não sugere nada e explica por quê', () => {
    const result = pruneProposals([signal(), signal()], 12, config, NOW)
    expect(result.proposals).toEqual([])
    expect(result.note).toMatch(/Poucos dados/)
    expect(result.coverage).toMatchObject({ siteViews: 12, minSiteViews: 500 })
  })

  it('com tráfego, sugere o que foi visto e ignorado e protege o que tem sinal de interesse', () => {
    const ignored = signal({ name: 'Ignorado', views: 40 })
    const clicked = signal({ name: 'Clicado', views: 40, clicks: 1 })
    const favorited = signal({ name: 'Favoritado', favorites: 1 })
    const sold = signal({ name: 'Vendeu', conversions: 1 })
    const locked = signal({ name: 'Editado', locked: true })
    const fresh = signal({ name: 'Novo', createdAt: daysAgo(3) })
    const many = Array.from({ length: 20 }, () => signal({ views: 11 }))
    const result = pruneProposals([ignored, clicked, favorited, sold, locked, fresh, ...many], 900, config, NOW)
    const titles = result.proposals.map((proposal) => proposal.title)
    expect(titles[0]).toContain('Ignorado')
    for (const protectedName of ['Clicado', 'Favoritado', 'Vendeu', 'Editado', 'Novo']) expect(titles.join(' ')).not.toContain(protectedName)
  })

  it('respeita o teto por execução e a parte máxima do catálogo', () => {
    const all = Array.from({ length: 100 }, () => signal({ views: 15 }))
    const result = pruneProposals(all, 5000, { ...config, maxPerRun: 25, maxShare: 0.1 }, NOW)
    expect(result.proposals).toHaveLength(10) // 10% de 100
    expect(pruneProposals(all, 5000, { ...config, maxPerRun: 3, maxShare: 0.5 }, NOW).proposals).toHaveLength(3)
  })

  it('quem nunca foi visto não sai: falta de exposição não é falta de qualidade', () => {
    const unseen = Array.from({ length: 30 }, () => signal({ views: 3 }))
    expect(pruneProposals(unseen, 900, config, NOW).proposals).toEqual([])
    expect(pruneProposals(unseen, 900, { ...config, minProductViews: 0 }, NOW).proposals.length).toBeGreaterThan(0)
  })

  it('cada proposta carrega o motivo e os números que a justificam', () => {
    const [proposal] = pruneProposals([signal({ views: 12 }), ...Array.from({ length: 9 }, () => signal())], 800, config, NOW).proposals
    expect(proposal).toMatchObject({ kind: 'archive_product', subjectType: 'product' })
    expect(proposal.reason).toContain('12 visitas')
    expect(proposal.evidence).toMatchObject({ views: 12, clicks: 0, siteViews: 800 })
    expect(proposal.expiresAt).toBeTruthy()
  })
})

describe('radar sazonal', () => {
  const config = defaultEngineConfig

  it('sugere termos de eventos próximos e informa data e antecedência', () => {
    const drafts = seasonalProposals('2026-11-01', config, new Set())
    const bf = drafts.filter((draft) => (draft.evidence as { event: string }).event === 'black-friday')
    expect(bf.length).toBeGreaterThan(0)
    expect(bf[0].reason).toContain('Black Friday')
    expect(bf[0].payload).toMatchObject({ until: '2026-11-29' })
  })

  it('ignora termos que o importador já usa, sem diferenciar acento ou caixa', () => {
    const all = seasonalProposals('2026-11-01', config, new Set())
    const known = new Set(['Robô Aspirador', 'AIR FRYER'])
    const filtered = seasonalProposals('2026-11-01', config, known)
    expect(filtered.length).toBeLessThan(all.length)
    expect(filtered.some((draft) => /robo aspirador|air fryer/i.test(String((draft.payload as { keyword: string }).keyword)))).toBe(false)
  })

  it('não repete o mesmo termo de dois eventos e respeita o desligamento', () => {
    const drafts = seasonalProposals('2026-11-05', config, new Set())
    expect(new Set(drafts.map((draft) => draft.subjectId)).size).toBe(drafts.length)
    expect(seasonalProposals('2026-11-05', { ...config, seasonalEnabled: false }, new Set())).toEqual([])
  })
})
