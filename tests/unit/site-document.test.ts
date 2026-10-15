import { describe, expect, it } from 'vitest'
import {
  applyHeroCopy, defaultHomeDocument, MAX_ITEMS, MAX_SECTIONS, missingBuiltins, newSection, normalizeDocument, sectionTypeList, sectionTypes,
  type SiteDocument,
} from '@/lib/site-builder/document'

const ok = (input: unknown) => {
  const result = normalizeDocument(input)
  if ('errors' in result) throw new Error(`esperava válido: ${JSON.stringify(result.errors)}`)
  return result.value
}
const errorsOf = (input: unknown) => {
  const result = normalizeDocument(input)
  if ('value' in result) throw new Error('esperava erros')
  return result.errors
}

describe('documento padrão da home', () => {
  it('reproduz a home de antes do editor, com as coleções logo abaixo da vitrine', () => {
    const doc = defaultHomeDocument({})
    expect(doc.sections.map((section) => section.type)).toEqual(['hero', 'campaign', 'catalog', ...Array(5).fill('collection'), 'selections', 'guides', 'howItWorks'])
    expect(doc.sections.every((section) => !section.hidden)).toBe(true)
    expect(doc.sections[0].settings).toMatchObject({ title: 'Bons produtos.', accent: 'Preços que valem.', buttonLabel: 'Ver ofertas' })
    expect(doc.sections.find((section) => section.type === 'guides')?.settings.title).toBe('Antes de comprar.')
    expect(doc.sections.find((section) => section.type === 'howItWorks')?.settings.title).toBe('Você escolhe.\nA gente ajuda a encontrar.')
  })

  it('respeita textos, ordem e visibilidade salvos na configuração antiga', () => {
    const doc = defaultHomeDocument({
      heroTitle: 'Achados.', heroAccent: 'Todo dia.', heroLead: 'Texto novo.', ctaLabel: 'Entrar',
      sectionOrder: ['howItWorks', 'catalog'], show_guides: false, show_selections: false,
    })
    expect(doc.sections[0].settings).toMatchObject({ title: 'Achados.', accent: 'Todo dia.', text: 'Texto novo.', buttonLabel: 'Entrar' })
    const rest = doc.sections.slice(2).filter((section) => section.type !== 'collection')
    // As que o setting não citou entram no fim, na ordem original.
    expect(rest.map((section) => section.type)).toEqual(['howItWorks', 'catalog', 'selections', 'guides'])
    expect(Object.fromEntries(rest.map((section) => [section.type, section.hidden]))).toMatchObject({ guides: true, selections: true, catalog: false })
  })

  it('o padrão passa na própria validação', () => {
    expect(() => ok(defaultHomeDocument({}))).not.toThrow()
  })
})

describe('validação do documento', () => {
  const base = (): SiteDocument => defaultHomeDocument({})

  it('aceita cada tipo de bloco recém-criado', () => {
    for (const type of sectionTypeList.filter((candidate) => !sectionTypes[candidate].builtin)) {
      const doc = ok({ ...base(), sections: [...base().sections, newSection(type)] })
      expect(doc.sections.at(-1)?.type).toBe(type)
    }
  })

  it('recusa tipo desconhecido, documento vazio e excesso de seções', () => {
    expect(errorsOf({ schemaVersion: 1, sections: [{ id: 'x', type: 'script', name: 'x' }] })['sections.0']).toBeTruthy()
    expect(errorsOf({ schemaVersion: 1, sections: [] }).sections).toBeTruthy()
    expect(errorsOf('texto')).toHaveProperty('sections')
    const many = Array.from({ length: MAX_SECTIONS + 1 }, () => newSection('spacer'))
    expect(errorsOf({ schemaVersion: 1, sections: many }).sections).toMatch(/No máximo/)
  })

  it('só uma seção interna de cada tipo', () => {
    const doc = base()
    const errors = errorsOf({ ...doc, sections: [...doc.sections, { ...doc.sections[2], id: 'outra-vitrine' }] })
    expect(Object.values(errors).join(' ')).toMatch(/só pode aparecer uma vez/)
  })

  it('links e imagens só do próprio site ou https', () => {
    const banner = newSection('banner')
    for (const href of ['javascript:alert(1)', 'http://inseguro.example', '//outro.site', 'data:text/html,x', '/ok com espaço']) {
      const errors = errorsOf({ schemaVersion: 1, sections: [{ ...banner, settings: { ...banner.settings, buttonHref: href } }] })
      expect(Object.keys(errors).some((key) => key.endsWith('buttonHref')), href).toBe(true)
    }
    const good = ok({ schemaVersion: 1, sections: [{ ...banner, settings: { ...banner.settings, buttonHref: 'https://shopee.com.br/x', image: '/img/a.png' } }] })
    expect(good.sections[0].settings).toMatchObject({ buttonHref: 'https://shopee.com.br/x', image: '/img/a.png' })
    expect(Object.keys(errorsOf({ schemaVersion: 1, sections: [{ ...banner, settings: { image: 'javascript:1' } }] })).some((key) => key.endsWith('image'))).toBe(true)
  })

  it('descarta campos desconhecidos e recusa texto acima do limite', () => {
    const text = newSection('text')
    const doc = ok({ schemaVersion: 1, sections: [{ ...text, evil: '<script>', settings: { ...text.settings, html: '<b>x</b>' } }] })
    expect(doc.sections[0]).not.toHaveProperty('evil')
    expect(doc.sections[0].settings).not.toHaveProperty('html')
    expect(errorsOf({ schemaVersion: 1, sections: [{ ...text, settings: { ...text.settings, title: 'T'.repeat(500) } }] })['sections.0.settings.title']).toMatch(/No máximo 90/)
  })

  it('limita e normaliza os cartões', () => {
    const cards = newSection('cards')
    const items = Array.from({ length: MAX_ITEMS + 4 }, (_, index) => ({ id: `i${index}`, title: `Cartão ${index}`, text: '', image: '', href: '/colecoes' }))
    const doc = ok({ schemaVersion: 1, sections: [{ ...cards, settings: { items } }] })
    expect(doc.sections[0].settings.items).toHaveLength(MAX_ITEMS)
    const bad = errorsOf({ schemaVersion: 1, sections: [{ ...cards, settings: { items: [{ id: 'a', title: 'x', href: 'javascript:1' }] } }] })
    expect(Object.keys(bad)[0]).toMatch(/items\.0\.href$/)
  })

  it('identificadores repetidos ganham um novo', () => {
    const a = newSection('spacer')
    const doc = ok({ schemaVersion: 1, sections: [a, { ...a }] })
    expect(new Set(doc.sections.map((section) => section.id)).size).toBe(2)
  })

  it('lista as seções internas que faltam', () => {
    const doc = ok({ ...base(), sections: base().sections.filter((section) => section.type !== 'guides' && section.type !== 'catalog') })
    expect(missingBuiltins(doc).sort()).toEqual(['catalog', 'guides'])
  })
})

describe('aplicar a variante vencedora do teste A/B', () => {
  it('troca só os textos preenchidos do topo e preserva o resto da página', () => {
    const base = defaultHomeDocument({})
    const next = applyHeroCopy(base, { title: 'Achados do dia', buttonLabel: '' })
    const hero = next.sections.find((section) => section.type === 'hero')!
    expect(hero.settings).toMatchObject({ title: 'Achados do dia', accent: 'Preços que valem.', buttonLabel: 'Ver ofertas' })
    expect(next.sections.map((section) => section.type)).toEqual(base.sections.map((section) => section.type))
    expect(base.sections[0].settings.title).toBe('Bons produtos.')
  })
})
