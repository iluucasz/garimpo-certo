import { describe, expect, it } from 'vitest'
import { CAPTION_LIMIT, cleanTitle, composePost, escapeHtml, pick, priceLine, proofLine, type PostFacts } from '@/lib/social/compose'
import { defaultPickOptions, rankCandidates, scoreCandidate, type PostCandidate } from '@/lib/social/picker'
import { brasiliaDay, brasiliaTime, missingSlots, slotsForDay } from '@/lib/social/schedule'

const facts = (patch: Partial<PostFacts> = {}): PostFacts => ({ name: 'Fone Bluetooth Sem Fio TWS', price: 39.9, originalPrice: 59.9, discountPercent: 33.4, rating: 4.8, soldCount: 1250, ...patch })

describe('texto da postagem', () => {
  it('usa só números reais e mostra o "de/por" quando há preço anterior', () => {
    const { text } = composePost(facts(), 'https://s.shopee.com.br/abc', 'p1')
    expect(text).toContain('R$ 59,90')
    expect(text).toContain('R$ 39,90')
    expect(text).toContain('−33%')
    expect(text).toContain('Nota 4,8')
    expect(text).toContain('1,3 mil vendas')
    expect(text).toContain('https://s.shopee.com.br/abc')
    expect(text).not.toContain('Link de afiliado')
  })

  it('sem preço anterior não inventa desconto', () => {
    const line = priceLine(facts({ originalPrice: null, discountPercent: null }))
    expect(line).toBe('<b>R$ 39,90</b>')
    expect(priceLine(facts({ discountPercent: 2 }))).not.toContain('de R$')
  })

  it('omite nota e vendas que não existem', () => {
    expect(proofLine(facts({ rating: 0, soldCount: 10 }))).toBe('')
    expect(proofLine(facts({ soldCount: 10 }))).toBe('Nota 4,8')
  })

  it('escapa HTML do nome e do link', () => {
    const { text } = composePost(facts({ name: 'Cabo <USB> & Carregador' }), 'https://x.test/?a=1&b=2', 'p2')
    expect(text).toContain('Cabo &lt;USB&gt; &amp; Carregador')
    expect(text).toContain('a=1&amp;b=2')
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;')
  })

  it('o mesmo produto sempre usa o mesmo modelo e produtos diferentes variam', () => {
    expect(pick('abc', 5)).toBe(pick('abc', 5))
    const used = new Set(Array.from({ length: 40 }, (_, index) => composePost(facts(), 'https://s.shopee.com.br/x', `produto-${index}`).template))
    expect(used.size).toBeGreaterThanOrEqual(3)
  })

  it('suaviza título em caixa alta, tira emojis e limita o tamanho', () => {
    expect(cleanTitle('FONE BLUETOOTH SEM FIO ORIGINAL 🔥🔥')).toBe('Fone bluetooth sem fio original')
    const long = cleanTitle('Produto '.repeat(40), 60)
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith('…')).toBe(true)
  })

  it('respeita o limite da legenda de foto do Telegram', () => {
    const { text } = composePost(facts({ name: 'Nome muito longo '.repeat(80) }), 'https://s.shopee.com.br/abc', 'p3', { caption: true })
    expect(text.length).toBeLessThanOrEqual(CAPTION_LIMIT)
    expect(text).not.toContain('Link de afiliado')
  })
})

const candidate = (patch: Partial<PostCandidate> = {}): PostCandidate => ({
  productId: crypto.randomUUID(), offerId: crypto.randomUUID(), name: 'Produto', slug: 'produto', imageUrl: 'https://cf.shopee.com.br/a.jpg', category: 'casa',
  price: 50, originalPrice: 80, discountPercent: 37, rating: 4.8, soldCount: 2000, editorialScore: 85, commissionRate: 0.1, priceDropPercent: 10,
  externalUrl: 'https://shopee.com.br/product/1/2', lastPostedAt: null, ...patch,
})
const NOW = Date.UTC(2026, 9, 13, 15, 0, 0)

describe('escolha das ofertas', () => {
  const options = { ...defaultPickOptions, now: NOW, limit: 3 }

  it('só aceita oferta com nota, vendas, preço e imagem suficientes', () => {
    const list = [candidate({ rating: 4.2 }), candidate({ soldCount: 20 }), candidate({ price: 5 }), candidate({ imageUrl: null }), candidate()]
    expect(rankCandidates(list, options)).toHaveLength(1)
  })

  it('não repete produto divulgado há pouco', () => {
    const recent = candidate({ lastPostedAt: new Date(NOW - 3 * 86_400_000).toISOString() })
    const old = candidate({ lastPostedAt: new Date(NOW - 30 * 86_400_000).toISOString(), category: 'audio' })
    expect(rankCandidates([recent, old], options).map((item) => item.candidate.productId)).toEqual([old.productId])
  })

  it('espalha por categoria e ordena pela nota interna', () => {
    const a = candidate({ category: 'casa', editorialScore: 95 })
    const b = candidate({ category: 'casa', editorialScore: 90 })
    const c = candidate({ category: 'audio', editorialScore: 70 })
    const result = rankCandidates([b, c, a], options)
    expect(result.map((item) => item.candidate.productId)).toEqual([a.productId, c.productId])
  })

  it('a comissão só desempata de leve: qualidade e desconto pesam mais', () => {
    const quality = scoreCandidate(candidate({ editorialScore: 90, commissionRate: 0.02 }))
    const greedy = scoreCandidate(candidate({ editorialScore: 60, commissionRate: 0.2 }))
    expect(quality.score).toBeGreaterThan(greedy.score)
  })

  it('explica por que escolheu', () => {
    const { reasons } = scoreCandidate(candidate({ editorialScore: 88, discountPercent: 30, priceDropPercent: 12, soldCount: 5000 }))
    expect(reasons.join(' ')).toMatch(/Índice Garimpo 88/)
    expect(reasons.join(' ')).toMatch(/30% abaixo/)
  })
})

describe('horários', () => {
  it('converte Brasília (UTC−3) nos dois sentidos', () => {
    expect(brasiliaDay(Date.UTC(2026, 9, 13, 2, 0, 0))).toBe('2026-10-12') // 23h do dia anterior em Brasília
    expect(brasiliaDay(Date.UTC(2026, 9, 13, 3, 0, 0))).toBe('2026-10-13')
    expect(new Date(brasiliaTime('2026-10-13', 9)).toISOString()).toBe('2026-10-13T12:00:00.000Z')
  })

  it('espalha as postagens do dia de forma uniforme', () => {
    const slots = slotsForDay('2026-10-13', 4, 9, 21).map((slot) => new Date(slot).toISOString().slice(11, 16))
    expect(slots).toEqual(['12:00', '16:00', '20:00', '00:00'])
    expect(slotsForDay('2026-10-13', 1, 9, 21).map((slot) => new Date(slot).toISOString().slice(11, 16))).toEqual(['18:00'])
    expect(slotsForDay('2026-10-13', 0, 9, 21)).toEqual([])
  })

  it('só planeja o que falta da cota e só no futuro', () => {
    const day = '2026-10-13'
    const now = brasiliaTime(day, 13) // 13h em Brasília
    const all = missingSlots({ now, dailyLimit: 4, startHour: 9, endHour: 21, existing: [] })
    // Grade 9h, 13h, 17h, 21h: 9h e 13h (agora) já passaram ou não são futuras.
    expect(all.map((slot) => new Date(slot - 0).toISOString().slice(11, 16))).toEqual(['20:00', '00:00'])
    const withOne = missingSlots({ now, dailyLimit: 4, startHour: 9, endHour: 21, existing: [brasiliaTime(day, 11), brasiliaTime(day, 17)] })
    // 17h já está ocupada: sobra só a das 21h, mesmo faltando duas para a cota.
    expect(withOne).toEqual([brasiliaTime(day, 21)])
    expect(missingSlots({ now, dailyLimit: 2, startHour: 9, endHour: 21, existing: [brasiliaTime(day, 10), brasiliaTime(day, 18)] })).toEqual([])
  })
})
