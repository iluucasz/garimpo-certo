import { describe, expect, it } from 'vitest'
import { normalizeSetting, settingDefinitions } from '@/lib/admin/settings-defs'
import { buildCollections, isReservedCollectionSlug } from '@/lib/catalog/collections'
import { buildGuide, guideChecklists, parseChecklist, resolveChecklists, serializeChecklist } from '@/lib/catalog/guides'
import { defaultCatalogRules, resolveRules, salesLabel } from '@/lib/catalog/rules'
import { matchesSignal } from '@/lib/catalog/signals'
import type { Category, Offer, Product } from '@/lib/types'

const product = (id: string, category: string, rating: number, score = 80): Product => ({
  id, slug: `p-${id}`, name: `Produto ${id}`, brand: 'Loja', category, description: '', longDescription: '', image: '/x.jpg', images: [],
  rating, reviews: 0, score, growth: 0, tags: [], specs: {}, priceHistory: [],
})
const offer = (productId: string, price: number, soldCount: number, previousPrice?: number): Offer => ({
  id: `o-${productId}`, productId, providerId: 'shopee', price, previousPrice, shipping: 0, installment: '', stock: 'disponível', url: 'https://shopee.example/x', updatedAt: 'agora', soldCount,
})
const categories: Category[] = [{ id: 'c1', name: 'Casa', slug: 'casa', icon: '', description: '' }]

// 4 produtos com 600 a 900 vendas: ficam fora de "Mais vendidos" com a regra padrão (1000).
const products = ['1', '2', '3', '4'].map((id) => product(id, 'casa', 4.9))
const offers = [offer('1', 30, 900), offer('2', 40, 800), offer('3', 50, 700), offer('4', 60, 600)]

describe('regras editáveis do catálogo', () => {
  it('usa os critérios originais quando nada foi salvo', () => {
    expect(resolveRules(undefined)).toEqual(defaultCatalogRules)
    expect(resolveRules({})).toEqual(defaultCatalogRules)
    expect(defaultCatalogRules).toMatchObject({ viralSales: 10_000, topSales: 1_000, promoDiscount: 20, valueScore: 85, valuePriceMax: 1_500 })
  })

  it('ignora valores inválidos em vez de quebrar o site', () => {
    const rules = resolveRules({ topSales: 'abc', viralSales: -5, lovedRating: null, findsPrice: 45 })
    expect(rules.topSales).toBe(1_000)
    expect(rules.viralSales).toBe(10_000)
    expect(rules.lovedRating).toBe(4.8)
    expect(rules.findsPrice).toBe(45)
  })

  it('mudar o limiar muda quais produtos entram na coleção e o texto acompanha', () => {
    const base = { products, offers, categories }
    expect(buildCollections(base).some((collection) => collection.slug === 'mais-vendidos')).toBe(false)

    const lowered = buildCollections({ ...base, rules: resolveRules({ topSales: 500 }) }).find((collection) => collection.slug === 'mais-vendidos')
    expect(lowered?.products).toHaveLength(4)
    expect(lowered?.description).toContain('mais de 500 vendas')
  })

  it('o filtro da busca usa o mesmo limiar da coleção', () => {
    const rules = resolveRules({ topSales: 500 })
    expect(matchesSignal('Mais vendidos', products[3], offers, defaultCatalogRules)).toBe(false)
    expect(matchesSignal('Mais vendidos', products[3], offers, rules)).toBe(true)
  })

  it('formata os números como o site fala', () => {
    expect(salesLabel(10_000)).toBe('10 mil')
    expect(salesLabel(1_000)).toBe('mil')
    expect(salesLabel(1_500)).toBe('1,5 mil')
    expect(salesLabel(500)).toBe('500')
  })

  it('o endereço das coleções automáticas continua reservado', () => {
    expect(isReservedCollectionSlug('viralizou')).toBe(true)
    expect(isReservedCollectionSlug('mais-vendidos-casa')).toBe(true)
    expect(isReservedCollectionSlug('minha-selecao')).toBe(false)
  })
})

describe('configuração "rules" no painel', () => {
  it('tem todos os limiares como campos e o padrão do código', () => {
    const definition = settingDefinitions.rules
    expect(definition.fields.map((field) => field.key).sort()).toEqual(Object.keys(defaultCatalogRules).sort())
    expect(definition.defaults).toEqual(defaultCatalogRules)
  })

  it('valida faixa e coerência entre os descontos', () => {
    expect(normalizeSetting('rules', { ...defaultCatalogRules })).toHaveProperty('value')
    expect(normalizeSetting('rules', { ...defaultCatalogRules, topSales: 5 })).toHaveProperty('errors.topSales')
    expect(normalizeSetting('rules', { ...defaultCatalogRules, promoDiscount: 40, heavyDiscount: 20 })).toHaveProperty('errors.heavyDiscount')
  })

  it('aceita nota com uma casa decimal', () => {
    const result = normalizeSetting('rules', { ...defaultCatalogRules, topRating: 4.6 })
    expect(result).toHaveProperty('value.topRating', 4.6)
  })
})

describe('checklists dos guias editáveis', () => {
  it('lê e grava no formato "Título | Texto"', () => {
    const parsed = parseChecklist('Voltagem | Confirme 110 V ou 220 V.\nGarantia | Veja o prazo.')
    expect(parsed.error).toBeUndefined()
    expect(parsed.checks).toEqual([{ title: 'Voltagem', text: 'Confirme 110 V ou 220 V.' }, { title: 'Garantia', text: 'Veja o prazo.' }])
    expect(parseChecklist(serializeChecklist(parsed.checks)).checks).toEqual(parsed.checks)
  })

  it('aponta a linha com problema', () => {
    expect(parseChecklist('sem separador').error).toMatch(/Linha 1/)
    expect(parseChecklist('Título | ok\n | sem título').error).toMatch(/Linha 2/)
    expect(parseChecklist(Array.from({ length: 7 }, (_, index) => `T${index} | texto`).join('\n')).error).toMatch(/No máximo 6/)
    expect(parseChecklist(`T | ${'x'.repeat(300)}`).error).toMatch(/passa de/)
  })

  it('o padrão do painel reproduz exatamente os textos do código', () => {
    const defaults = settingDefinitions.guides.defaults as Record<string, string>
    for (const [slug, checks] of Object.entries(guideChecklists)) {
      expect(defaults[slug]).toBe(serializeChecklist(checks))
      expect(parseChecklist(defaults[slug]).checks).toEqual(checks)
    }
  })

  it('texto salvo vence o do código; categoria vazia ou inválida mantém o original', () => {
    const resolved = resolveChecklists({ casa: 'Medida | Meça o espaço.', audio: '', pet: 'linha quebrada' })
    expect(resolved).toEqual({ casa: [{ title: 'Medida', text: 'Meça o espaço.' }] })

    const catalog = { products: [...products, product('5', 'casa', 4.5)], offers: [...offers, offer('5', 20, 100)], categories }
    expect(buildGuide(catalog, 'casa')!.checks).toEqual(guideChecklists.casa)
    expect(buildGuide({ ...catalog, checklists: resolved }, 'casa')!.checks).toEqual([{ title: 'Medida', text: 'Meça o espaço.' }])
  })

  it('valida o campo ao salvar', () => {
    expect(normalizeSetting('guides', { casa: 'sem separador' })).toHaveProperty('errors.casa')
    const ok = normalizeSetting('guides', { casa: '  Medida | Meça o espaço.  ' })
    expect(ok).toHaveProperty('value.casa', 'Medida | Meça o espaço.')
  })
})
