import { describe, expect, it } from 'vitest'
import { contrastWithWhite, normalizeSetting, settingDefinitions } from '@/lib/admin/settings-defs'

const valid = (key: Parameters<typeof normalizeSetting>[0], input: unknown) => {
  const result = normalizeSetting(key, input)
  if ('errors' in result) throw new Error(JSON.stringify(result.errors))
  return result.value
}

describe('configurações do painel', () => {
  it('completa com os padrões quando o valor vem vazio', () => {
    for (const key of Object.keys(settingDefinitions) as (keyof typeof settingDefinitions)[]) {
      expect(() => valid(key, {})).not.toThrow()
    }
    expect(valid('seo', {}).titleTemplate).toBe('%s · Garimpo')
  })

  it('exige %s no modelo de título', () => {
    const result = normalizeSetting('seo', { titleTemplate: 'Sem marcador' })
    expect('errors' in result && result.errors.titleTemplate).toBeTruthy()
  })

  it('recusa cor de ação sem contraste mínimo com branco', () => {
    expect(contrastWithWhite('#ffff00')).toBeLessThan(4.5)
    const result = normalizeSetting('theme', { primary: '#ffff00' })
    expect('errors' in result && result.errors.primary).toMatch(/Contraste/)
    expect(valid('theme', { primary: '#1d4ed8' }).primary).toBe('#1d4ed8')
  })

  it('aceita a cor original do site', () => {
    expect(contrastWithWhite('#c3441d')).toBeGreaterThanOrEqual(4.5)
  })

  it('mantém todas as seções da home mesmo se a ordem vier incompleta', () => {
    const value = valid('home', { sectionOrder: ['guides', 'invalida', 'guides'] })
    expect(value.sectionOrder).toEqual(['guides', 'catalog', 'selections', 'howItWorks'])
  })

  it('não deixa o ranking ficar com todos os pesos em zero', () => {
    const zeros = Object.fromEntries(['relevance', 'affinity', 'engagement', 'quality', 'commercial', 'price', 'freshness', 'similarity'].map((key) => [key, 0]))
    expect('errors' in normalizeSetting('ranking', zeros)).toBe(true)
  })

  it('limita valores numéricos e valida a lista de eventos', () => {
    expect('errors' in normalizeSetting('slots', { similarLimit: 99 })).toBe(true)
    expect('errors' in normalizeSetting('tracking', { disabledEvents: ['ok_event', 'com espaço'] })).toBe(true)
    expect(valid('tracking', { disabledEvents: 'page_view\npage_view\nsearch' }).disabledEvents).toEqual(['page_view', 'search'])
  })

  it('rejeita URL de imagem que não seja http(s)', () => {
    expect('errors' in normalizeSetting('seo', { ogImageUrl: 'javascript:alert(1)' })).toBe(true)
  })
})
