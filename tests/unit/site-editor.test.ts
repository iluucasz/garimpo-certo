import { describe, expect, it } from 'vitest'
import {
  defaultHomeDocument, isPageKey, MAX_SECTIONS, missingBuiltins, newSection, normalizeDocument, pageKeyFor, sectionTypes, slugify,
  starterPageDocument, visibleSections, type SiteDocument,
} from '@/lib/site-builder/document'
import { defaultDesign, MAX_FOOTER_LINKS, themeVariables } from '@/lib/site-builder/design'
import {
  canRedo, canUndo, createHistory, GROUP_WINDOW_MS, HISTORY_DEPTH, pushChange, redo, undo,
} from '@/lib/site-builder/history'
import {
  archiveSection, createSection, deleteSection, duplicateSection, insertSection, moveBy, moveSection, neighbourAfterRemoval,
  restoreSection, updateSection, updateSettings,
} from '@/lib/site-builder/operations'
import { contrast, isLightEnough, readableOn } from '@/lib/site-builder/visual'
import { isReservedCollectionSlug } from '@/lib/catalog/collections'
import { pickCollectionProducts } from '@/lib/site-builder/collection-picks'

const ok = (input: unknown, options?: { allowEmpty?: boolean }) => {
  const result = normalizeDocument(input, options)
  if ('errors' in result) throw new Error(`esperava válido: ${JSON.stringify(result.errors)}`)
  return result.value
}
const errorsOf = (input: unknown, options?: { allowEmpty?: boolean }) => {
  const result = normalizeDocument(input, options)
  if ('value' in result) throw new Error('esperava erros')
  return result.errors
}
const ids = (document: SiteDocument) => document.sections.map((section) => section.id)

describe('seções arquivadas e aparência', () => {
  it('arquivada sai da página, continua no documento e não libera a seção interna', () => {
    const base = defaultHomeDocument({})
    const archived = archiveSection(base, 'guides')
    expect(visibleSections(archived).map((section) => section.type)).not.toContain('guides')
    expect(archived.sections.find((section) => section.id === 'guides')?.archived).toBe(true)
    // Continua no documento: não dá para adicionar uma segunda seção "Guias de compra".
    expect(missingBuiltins(archived)).not.toContain('guides')
    expect(createSection(archived, 'guides')).toBeNull()
    expect(ok(archived).sections.find((section) => section.id === 'guides')?.archived).toBe(true)
  })

  it('restaurar traz a seção de volta e a mostra', () => {
    const hidden = updateSection(archiveSection(defaultHomeDocument({}), 'guides'), 'guides', { hidden: true })
    const restored = restoreSection(hidden, 'guides')
    expect(restored.sections.find((section) => section.id === 'guides')).toMatchObject({ archived: false, hidden: false })
  })

  it('valida fundo, cor, espaçamento e largura', () => {
    const banner = newSection('banner')
    const doc = ok({ schemaVersion: 1, sections: [{ ...banner, settings: { ...banner.settings, background: '#112233', color: '#FFFFFF', padding: 999, width: 'full' } }] })
    expect(doc.sections[0].settings).toMatchObject({ background: '#112233', color: '#ffffff', padding: 160, width: 'full' })
    const bad = errorsOf({ schemaVersion: 1, sections: [{ ...banner, settings: { ...banner.settings, background: 'vermelho', color: 'url(x)' } }] })
    expect(bad['sections.0.settings.background']).toBeTruthy()
    expect(bad['sections.0.settings.color']).toBeTruthy()
  })

  it('seção do site só aceita fundo claro e nunca troca a cor do texto', () => {
    const base = defaultHomeDocument({})
    const withBackground = (background: string, color?: string) => ({ ...base, sections: base.sections.map((section) => section.type === 'catalog' ? { ...section, settings: { background, color } } : section) })
    expect(errorsOf(withBackground('#0b1220'))['sections.2.settings.background']).toMatch(/escuro demais/)
    const light = ok(withBackground('#fff7ed', '#ff0000'))
    expect(light.sections[2].settings.background).toBe('#fff7ed')
    expect(light.sections[2].settings).not.toHaveProperty('color')
  })

  it('texto e imagem, perguntas e coleção entram como blocos livres e validam', () => {
    for (const type of ['imageText', 'faq', 'collection'] as const) {
      expect(sectionTypes[type].builtin).toBe(false)
      expect(() => ok({ schemaVersion: 1, sections: [newSection(type)] })).not.toThrow()
    }
    const collection = newSection('collection')
    expect(errorsOf({ schemaVersion: 1, sections: [{ ...collection, settings: { collection: '../etc/passwd' } }] })['sections.0.settings.collection']).toBeTruthy()
    // Perguntas não carregam imagem nem link, mesmo que venham no corpo.
    const faq = newSection('faq')
    const cleaned = ok({ schemaVersion: 1, sections: [{ ...faq, settings: { items: [{ id: 'a', title: 'P?', text: 'R.', image: 'https://x.com/a.png', href: '/x' }] } }] })
    expect(cleaned.sections[0].settings.items?.[0]).toMatchObject({ image: '', href: '' })
  })

  it('título e descrição da página são recortados; design é validado', () => {
    const doc = ok({ schemaVersion: 1, sections: [newSection('text')], page: { title: 'T'.repeat(200), description: 'D'.repeat(400), x: 1 } })
    expect(doc.page?.title).toHaveLength(70)
    expect(doc.page?.description).toHaveLength(160)
    expect(doc.page).not.toHaveProperty('x')
  })
})

describe('coleções na home padrão', () => {
  const home = defaultHomeDocument({})

  it('mostra pelo menos 5 coleções logo abaixo da vitrine principal', () => {
    const order = home.sections.map((section) => section.type)
    const catalog = order.indexOf('catalog')
    const collections = home.sections.filter((section) => section.type === 'collection')
    expect(collections.length).toBeGreaterThanOrEqual(5)
    expect(order.slice(catalog + 1, catalog + 1 + collections.length).every((type) => type === 'collection')).toBe(true)
    expect(new Set(collections.map((section) => section.settings.collection)).size).toBe(collections.length)
    expect(collections.every((section) => section.settings.count === 8)).toBe(true)
  })

  it('só aponta para coleções automáticas que existem e passa na validação', () => {
    for (const section of home.sections.filter((item) => item.type === 'collection')) {
      expect(isReservedCollectionSlug(section.settings.collection ?? '')).toBe(true)
    }
    expect(() => ok(home)).not.toThrow()
  })

  it('esconder pelo painel antigo (show_collections) tira todas as coleções', () => {
    const hidden = defaultHomeDocument({ show_collections: false })
    expect(visibleSections(hidden).some((section) => section.type === 'collection')).toBe(false)
  })

  it('a quantidade de produtos aceita 4 a 8 e é limitada', () => {
    const block = { ...newSection('collection'), settings: { collection: 'queridinhos', count: 99 } }
    const result = ok({ schemaVersion: 1, sections: [block] })
    expect(result.sections[0].settings.count).toBe(8)
  })
})

describe('operações sobre o documento', () => {
  // As coleções da home padrão não fazem parte do que estas operações testam: fixa a ordem das seções internas.
  const full = defaultHomeDocument({})
  const base: SiteDocument = { ...full, sections: full.sections.filter((section) => section.type !== 'collection') }

  it('mover antes de outra seção, ou para o fim, sem alterar o original', () => {
    const before = ids(base)
    const moved = moveSection(base, 'howItWorks', 'catalog')
    expect(ids(moved).indexOf('howItWorks')).toBe(ids(moved).indexOf('catalog') - 1)
    expect(ids(base)).toEqual(before)
    expect(ids(moveSection(base, 'hero', null)).at(-1)).toBe('hero')
    // Soltar no mesmo lugar não cria um passo no histórico.
    expect(moveSection(base, 'catalog', 'selections')).toBe(base)
  })

  it('subir e descer pulam as arquivadas', () => {
    const doc = archiveSection(base, 'selections')
    const down = moveBy(doc, 'catalog', 1)
    // "selections" está arquivada: "catalog" passa direto por ela e vai para depois de "guides".
    const order = ids(down).filter((id) => id !== 'selections')
    expect(order.indexOf('catalog')).toBe(order.indexOf('guides') + 1)
    expect(moveBy(base, 'hero', -1)).toBe(base)
    expect(moveBy(base, 'howItWorks', 1)).toBe(base)
  })

  it('duplicar copia os itens com identificadores novos; seção interna não duplica', () => {
    const cards = newSection('cards')
    const doc: SiteDocument = { ...base, sections: [...base.sections, cards] }
    const result = duplicateSection(doc, cards.id)!
    const original = result.document.sections.find((section) => section.id === cards.id)!
    expect(result.copy.settings.items?.[0].id).not.toBe(original.settings.items?.[0].id)
    expect(ids(result.document).indexOf(result.copy.id)).toBe(ids(result.document).indexOf(cards.id) + 1)
    expect(duplicateSection(base, 'catalog')).toBeNull()
  })

  it('inserir respeita o limite de seções', () => {
    const full: SiteDocument = { schemaVersion: 1, sections: Array.from({ length: MAX_SECTIONS }, () => newSection('spacer')) }
    expect(insertSection(full, newSection('text'), null)).toBeNull()
    expect(duplicateSection(full, full.sections[0].id)).toBeNull()
  })

  it('updateSettings remove o campo quando o valor é undefined', () => {
    const banner = newSection('banner')
    const doc: SiteDocument = { schemaVersion: 1, sections: [{ ...banner, settings: { ...banner.settings, background: '#ffffff', padding: 24 } }] }
    const next = updateSettings(doc, banner.id, { background: undefined, title: 'Novo' })
    expect(next.sections[0].settings).not.toHaveProperty('background')
    expect(next.sections[0].settings).toMatchObject({ title: 'Novo', padding: 24 })
    expect(doc.sections[0].settings.background).toBe('#ffffff')
  })

  it('apagar de vez e escolher a vizinha depois de arquivar', () => {
    expect(ids(deleteSection(base, 'guides'))).not.toContain('guides')
    expect(neighbourAfterRemoval(base, 'catalog')).toBe('selections')
    expect(neighbourAfterRemoval(base, 'howItWorks')).toBe('guides')
  })
})

describe('histórico de desfazer e refazer', () => {
  it('desfaz e refaz na ordem, e uma edição nova limpa o refazer', () => {
    let history = createHistory('a')
    history = pushChange(history, 'b', '', 0)
    history = pushChange(history, 'c', '', 5000)
    expect(history.present).toBe('c')
    history = undo(history)
    expect(history.present).toBe('b')
    expect(canRedo(history)).toBe(true)
    history = redo(history)
    expect(history.present).toBe('c')
    history = undo(undo(history))
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)
    history = pushChange(history, 'x', '', 9000)
    expect(canRedo(history)).toBe(false)
  })

  it('digitar no mesmo campo vira um passo só; outro campo ou pausa abre outro', () => {
    let history = createHistory('')
    history = pushChange(history, 'O', 'titulo', 1000)
    history = pushChange(history, 'Ol', 'titulo', 1100)
    history = pushChange(history, 'Olá', 'titulo', 1200)
    expect(history.past).toHaveLength(1)
    history = pushChange(history, 'Olá!', 'titulo', 1200 + GROUP_WINDOW_MS + 1)
    expect(history.past).toHaveLength(2)
    history = pushChange(history, 'Olá!!', 'texto', 1200 + GROUP_WINDOW_MS + 10)
    expect(history.past).toHaveLength(3)
    expect(undo(undo(history)).present).toBe('Olá')
  })

  it('alteração sem efeito não cria passo e o histórico tem profundidade limitada', () => {
    const start = createHistory({ n: 0 })
    expect(pushChange(start, { n: 0 })).toBe(start)
    let history = start
    for (let n = 1; n <= HISTORY_DEPTH + 20; n++) history = pushChange(history, { n }, '', n * 10_000)
    expect(history.past).toHaveLength(HISTORY_DEPTH)
  })
})

describe('páginas criadas no painel', () => {
  it('slugify tira acentos e símbolos', () => {
    expect(slugify('Dia das Mães 2026!')).toBe('dia-das-maes-2026')
    expect(slugify('  --Presentes & Ofertas--  ')).toBe('presentes-ofertas')
    expect(slugify('!!!')).toBe('')
    expect(slugify('a'.repeat(100))).toHaveLength(60)
  })

  it('só aceita chaves page:<endereço> bem formadas', () => {
    expect(isPageKey(pageKeyFor('dia-das-maes'))).toBe(true)
    for (const key of ['home', 'page:', 'page:Maiúscula', 'page:com espaço', 'page:../x', 'page:a--b-', `page:${'a'.repeat(61)}`]) expect(isPageKey(key), key).toBe(false)
  })

  it('o ponto de partida é válido e leva o título', () => {
    const doc = starterPageDocument('Dia das Mães')
    expect(ok(doc).page?.title).toBe('Dia das Mães')
    expect(doc.sections[0].settings.title).toBe('Dia das Mães')
  })
})

describe('aparência do site (design global)', () => {
  const global = (design: unknown) => ({ schemaVersion: 1, sections: [], design })

  it('o documento global pode não ter seções; páginas não', () => {
    expect(ok(global(defaultDesign()), { allowEmpty: true }).design).toBeTruthy()
    expect(errorsOf(global(defaultDesign())).sections).toBeTruthy()
  })

  it('parte das configurações atuais do tema e completa o que faltar', () => {
    const design = defaultDesign({ primary: '#1F6FEB', radius: 'round', noticeText: '', noticeDetail: 'x' })
    expect(design.theme).toMatchObject({ primary: '#1f6feb', radius: 'round', font: 'default' })
    expect(design.header).toEqual({ noticeText: '', noticeDetail: 'x' })
    const filled = ok(global({ theme: { primary: '#1d4ed8' } }), { allowEmpty: true }).design!
    expect(filled.theme).toMatchObject({ primary: '#1d4ed8', radius: 'default', font: 'default' })
    expect(filled.footer.signature).toBe('')
  })

  it('recusa cor de ação com pouco contraste, como o painel de Tema', () => {
    const errors = errorsOf(global({ theme: { primary: '#ffe08a' } }), { allowEmpty: true })
    expect(errors['design.theme.primary']).toMatch(/Contraste/)
    expect(errorsOf(global({ theme: { primary: 'azul' } }), { allowEmpty: true })['design.theme.primary']).toBeTruthy()
  })

  it('links do rodapé: limite, endereço seguro e itens vazios descartados', () => {
    const many = Array.from({ length: MAX_FOOTER_LINKS + 3 }, (_, index) => ({ id: `l${index}`, label: `Link ${index}`, href: '/colecoes' }))
    expect(ok(global({ footer: { links: many } }), { allowEmpty: true }).design!.footer.links).toHaveLength(MAX_FOOTER_LINKS)
    expect(ok(global({ footer: { links: [{ label: '', href: '' }] } }), { allowEmpty: true }).design!.footer.links).toHaveLength(0)
    const bad = errorsOf(global({ footer: { links: [{ label: 'x', href: 'javascript:alert(1)' }, { label: '', href: '/ok' }] } }), { allowEmpty: true })
    expect(bad['design.footer.links.0.href']).toBeTruthy()
    expect(bad['design.footer.links.1.label']).toBeTruthy()
  })

  it('o tema original não gera estilo; fonte e cor geram', () => {
    expect(themeVariables(defaultDesign())).toEqual({})
    const custom = themeVariables({ ...defaultDesign(), theme: { primary: '#1d4ed8', radius: 'compact', font: 'serif' } })
    expect(custom['--primary']).toBe('#1d4ed8')
    expect(custom['--radius-md']).toBe('5px')
    expect(custom['--font-body']).toMatch(/Georgia/)
  })
})

describe('contraste das seções', () => {
  it('escolhe texto branco em fundo escuro e azul-marinho em fundo claro', () => {
    expect(readableOn('#0b1220')).toBe('#ffffff')
    expect(readableOn('#fff7ed')).toBe('#172642')
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(isLightEnough('#ffffff')).toBe(true)
    expect(isLightEnough('#1c2434')).toBe(false)
  })
})

describe('escolha de produtos das coleções da home', () => {
  const list = (prefix: string, n: number) => Array.from({ length: n }, (_, index) => ({ id: `${prefix}${index}` }))
  const blocks = [
    { id: 'a', settings: { collection: 'x', count: 4 } },
    { id: 'b', settings: { collection: 'y', count: 4 } },
    { id: 'c', settings: { collection: 'inexistente', count: 4 } },
  ]

  it('não repete produto entre blocos nem com o que a vitrine já mostra', () => {
    const shared = [{ id: 's0' }, { id: 's1' }]
    const collections = [
      { slug: 'x', products: [...shared, ...list('x', 10)] },
      { slug: 'y', products: [...shared, ...list('x', 10).slice(0, 2), ...list('y', 10)] },
    ]
    const picks = pickCollectionProducts(blocks, collections, ['s0'])
    const all = [...picks.values()].flat()
    expect(new Set(all).size).toBe(all.length)
    expect(picks.get('a')).toEqual(['s1', 'x0', 'x1', 'x2'])
    expect(picks.get('b')).toEqual(['y0', 'y1', 'y2', 'y3'])
    expect(picks.has('c')).toBe(false)
  })

  it('completa com os melhores da coleção quando faltam produtos novos', () => {
    const picks = pickCollectionProducts([{ id: 'a', settings: { collection: 'x', count: 4 } }], [{ slug: 'x', products: list('x', 4) }], ['x0', 'x1'])
    expect(picks.get('a')).toEqual(['x2', 'x3', 'x0', 'x1'])
  })
})
