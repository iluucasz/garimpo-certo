/**
 * Documento do editor visual de páginas (Painel → Home e Páginas).
 *
 * Uma página é uma lista ordenada de seções. Há dois tipos:
 *  - **internas**: já existem no site e puxam dado real (vitrine, coleções, guias, campanha). A equipe muda
 *    a ordem, esconde e ajusta os textos, mas o conteúdo continua vindo do catálogo;
 *  - **blocos livres**: banner, texto, cartões, imagem, perguntas, chamada e espaçador, só com o que a pessoa
 *    escreveu (mais "Produtos de uma coleção", que lê o catálogo pelo endereço da coleção).
 *
 * Seção **arquivada** sai da página e da lista de trabalho, mas continua no documento e pode voltar. Nada é
 * apagado sem a pessoa pedir.
 *
 * Isomórfico: o painel desenha o formulário de cada seção a partir de `sectionTypes`, e o servidor valida o
 * mesmo documento com `normalizeDocument`. Sem documento publicado, a home usa `defaultHomeDocument`, que
 * reproduz exatamente a home de antes do editor.
 */
import { normalizeDesign, type SiteDesign } from './design'
import { clip, isHex, newId, safeImage, safeLink, type DocumentErrors } from './validate'
import { isLightEnough } from './visual'

export { newId }
export type { DocumentErrors }

export type SectionType =
  | 'hero' | 'campaign' | 'catalog' | 'selections' | 'guides' | 'howItWorks'
  | 'banner' | 'text' | 'cards' | 'image' | 'imageText' | 'faq' | 'collection' | 'cta' | 'spacer'

export type SectionItem = { id: string; title: string; text: string; image: string; href: string }

export type SectionSettings = {
  title?: string
  accent?: string
  text?: string
  eyebrow?: string
  image?: string
  alt?: string
  buttonLabel?: string
  buttonHref?: string
  align?: 'left' | 'center'
  tone?: 'default' | 'soft' | 'dark'
  height?: number
  items?: SectionItem[]
  collection?: string
  /** Quantos produtos o bloco de coleção mostra (4 ou 8; sem valor, 8). */
  count?: number
  imageSide?: 'left' | 'right'
  imageFit?: 'cover' | 'contain'
  /** Aparência (vale para qualquer seção). */
  background?: string
  color?: string
  padding?: number
  width?: 'contained' | 'full'
}

export type Section = { id: string; type: SectionType; name: string; hidden: boolean; archived: boolean; settings: SectionSettings }

export type PageMeta = { title?: string; description?: string }
export type SiteDocument = {
  schemaVersion: 1
  sections: Section[]
  /** Título e descrição nos buscadores. Só páginas criadas no editor; a home usa Configurações → SEO. */
  page?: PageMeta
  /** Só no documento `global` (Aparência do site). */
  design?: SiteDesign
}

export type FieldKind = 'text' | 'textarea' | 'markdown' | 'url' | 'image' | 'select' | 'number' | 'items' | 'collection'
export type SectionField = {
  key: keyof SectionSettings
  label: string
  kind: FieldKind
  help?: string
  maxLength?: number
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  unit?: string
  /** Para `items`: cartões (imagem, título, texto, link) ou perguntas e respostas. */
  variant?: 'cards' | 'faq'
}

export type SectionDefinition = {
  type: SectionType
  label: string
  description: string
  /** Seção interna: mostra dado real do site e só existe uma por página. */
  builtin: boolean
  fields: SectionField[]
}

const alignField: SectionField = { key: 'align', label: 'Alinhamento', kind: 'select', options: [{ value: 'left', label: 'À esquerda' }, { value: 'center', label: 'Centralizado' }] }
const toneField: SectionField = { key: 'tone', label: 'Fundo', kind: 'select', options: [{ value: 'default', label: 'Claro' }, { value: 'soft', label: 'Suave' }, { value: 'dark', label: 'Escuro' }] }
const fitField: SectionField = { key: 'imageFit', label: 'Enquadramento da imagem', kind: 'select', options: [{ value: 'cover', label: 'Preencher o espaço' }, { value: 'contain', label: 'Mostrar a imagem inteira' }] }

export const sectionTypes: Record<SectionType, SectionDefinition> = {
  hero: {
    type: 'hero', label: 'Topo da página', builtin: true,
    description: 'Título, texto de apoio e botão, com os destaques do dia ao lado.',
    fields: [
      { key: 'title', label: 'Título (linha 1)', kind: 'text', maxLength: 40 },
      { key: 'accent', label: 'Título (linha 2, em destaque)', kind: 'text', maxLength: 40 },
      { key: 'text', label: 'Texto de apoio', kind: 'textarea', maxLength: 200 },
      { key: 'buttonLabel', label: 'Texto do botão principal', kind: 'text', maxLength: 24 },
    ],
  },
  campaign: {
    type: 'campaign', label: 'Campanha em destaque', builtin: true,
    description: 'Mostra a campanha ativa de Experiência → Campanhas. Some sozinha quando não há campanha no período.',
    fields: [],
  },
  catalog: {
    type: 'catalog', label: 'Vitrine de produtos', builtin: true,
    description: 'Abas Em alta, Descontos, Bem avaliados e Até R$ 100, com produtos reais.',
    fields: [],
  },
  selections: {
    type: 'selections', label: 'Escolha pelo que importa', builtin: true,
    description: 'Atalhos para as coleções que existem hoje no catálogo.',
    fields: [],
  },
  guides: {
    type: 'guides', label: 'Guias de compra', builtin: true,
    description: 'Os três primeiros guias disponíveis. Some se não houver guia.',
    fields: [
      { key: 'title', label: 'Título', kind: 'text', maxLength: 60 },
      { key: 'text', label: 'Texto', kind: 'textarea', maxLength: 160 },
      { key: 'buttonLabel', label: 'Texto do link', kind: 'text', maxLength: 30 },
    ],
  },
  howItWorks: {
    type: 'howItWorks', label: 'Como funciona', builtin: true,
    description: 'Chamada curta para a página Como funciona.',
    fields: [
      { key: 'title', label: 'Título', kind: 'textarea', maxLength: 100, help: 'Use uma nova linha para quebrar o título.' },
      { key: 'text', label: 'Texto', kind: 'textarea', maxLength: 400 },
      { key: 'buttonLabel', label: 'Texto do link', kind: 'text', maxLength: 40 },
    ],
  },
  banner: {
    type: 'banner', label: 'Banner', builtin: false,
    description: 'Imagem de fundo ou lateral com título, texto e botão.',
    fields: [
      { key: 'eyebrow', label: 'Chamada pequena', kind: 'text', maxLength: 40 },
      { key: 'title', label: 'Título', kind: 'text', maxLength: 90 },
      { key: 'text', label: 'Texto', kind: 'textarea', maxLength: 300 },
      { key: 'image', label: 'Imagem', kind: 'image' },
      { key: 'alt', label: 'Descrição da imagem', kind: 'text', maxLength: 140, help: 'Para leitores de tela. Deixe vazio se a imagem for só decorativa.' },
      fitField,
      { key: 'buttonLabel', label: 'Texto do botão', kind: 'text', maxLength: 30 },
      { key: 'buttonHref', label: 'Link do botão', kind: 'url', help: 'Caminho do site (/colecoes) ou endereço https.' },
      alignField, toneField,
    ],
  },
  text: {
    type: 'text', label: 'Texto', builtin: false,
    description: 'Um bloco de texto em Markdown (títulos, listas, negrito e links).',
    fields: [
      { key: 'title', label: 'Título', kind: 'text', maxLength: 90 },
      { key: 'text', label: 'Texto', kind: 'markdown', maxLength: 6000 },
      alignField,
    ],
  },
  cards: {
    type: 'cards', label: 'Cartões', builtin: false,
    description: 'Uma grade de cartões com imagem, título, texto e link.',
    fields: [
      { key: 'title', label: 'Título da seção', kind: 'text', maxLength: 90 },
      { key: 'text', label: 'Texto de apoio', kind: 'textarea', maxLength: 300 },
      { key: 'items', label: 'Cartões', kind: 'items', variant: 'cards', maxLength: 300 },
    ],
  },
  image: {
    type: 'image', label: 'Imagem', builtin: false,
    description: 'Uma imagem, com link opcional.',
    fields: [
      { key: 'image', label: 'Imagem', kind: 'image' },
      { key: 'alt', label: 'Descrição da imagem', kind: 'text', maxLength: 140 },
      fitField,
      { key: 'buttonHref', label: 'Link da imagem', kind: 'url' },
    ],
  },
  imageText: {
    type: 'imageText', label: 'Texto e imagem', builtin: false,
    description: 'Duas colunas: um texto com botão ao lado de uma imagem.',
    fields: [
      { key: 'eyebrow', label: 'Chamada pequena', kind: 'text', maxLength: 40 },
      { key: 'title', label: 'Título', kind: 'text', maxLength: 90 },
      { key: 'text', label: 'Texto', kind: 'markdown', maxLength: 1500 },
      { key: 'image', label: 'Imagem', kind: 'image' },
      { key: 'alt', label: 'Descrição da imagem', kind: 'text', maxLength: 140 },
      fitField,
      { key: 'imageSide', label: 'Lado da imagem', kind: 'select', options: [{ value: 'right', label: 'À direita' }, { value: 'left', label: 'À esquerda' }] },
      { key: 'buttonLabel', label: 'Texto do botão', kind: 'text', maxLength: 30 },
      { key: 'buttonHref', label: 'Link do botão', kind: 'url' },
    ],
  },
  faq: {
    type: 'faq', label: 'Perguntas frequentes', builtin: false,
    description: 'Perguntas e respostas que abrem e fecham.',
    fields: [
      { key: 'title', label: 'Título da seção', kind: 'text', maxLength: 90 },
      { key: 'items', label: 'Perguntas', kind: 'items', variant: 'faq', maxLength: 800 },
    ],
  },
  collection: {
    type: 'collection', label: 'Produtos de uma coleção', builtin: false,
    description: 'Os primeiros produtos de uma coleção do catálogo, com os preços de hoje.',
    fields: [
      { key: 'title', label: 'Título', kind: 'text', maxLength: 90 },
      { key: 'text', label: 'Texto de apoio', kind: 'textarea', maxLength: 240 },
      { key: 'collection', label: 'Coleção', kind: 'collection' },
      { key: 'count', label: 'Produtos exibidos', kind: 'number', min: 4, max: 8, step: 4, unit: ' produtos' },
      { key: 'buttonLabel', label: 'Texto do link para a coleção', kind: 'text', maxLength: 40 },
    ],
  },
  cta: {
    type: 'cta', label: 'Chamada para ação', builtin: false,
    description: 'Faixa com uma frase e um botão.',
    fields: [
      { key: 'title', label: 'Título', kind: 'text', maxLength: 90 },
      { key: 'text', label: 'Texto', kind: 'textarea', maxLength: 240 },
      { key: 'buttonLabel', label: 'Texto do botão', kind: 'text', maxLength: 30 },
      { key: 'buttonHref', label: 'Link do botão', kind: 'url' },
      toneField,
    ],
  },
  spacer: {
    type: 'spacer', label: 'Espaço', builtin: false,
    description: 'Espaço vazio entre duas seções.',
    fields: [{ key: 'height', label: 'Altura', kind: 'number', min: 8, max: 160 }],
  },
}

export const sectionTypeList = Object.keys(sectionTypes) as SectionType[]
export const MAX_SECTIONS = 40
export const MAX_ITEMS = 8
export const MAX_PADDING = 160

/** Tipos que só mostram o que a equipe escreveu e, por isso, aceitam trocar a cor do texto. */
export const isFreeBlock = (type: SectionType) => !sectionTypes[type].builtin

export function newSection(type: SectionType): Section {
  const definition = sectionTypes[type]
  const settings: SectionSettings = {}
  if (type === 'banner') Object.assign(settings, { title: 'Título do banner', text: '', buttonLabel: 'Saiba mais', buttonHref: '/colecoes', align: 'left', tone: 'soft' })
  if (type === 'text') Object.assign(settings, { title: 'Título', text: 'Escreva aqui.', align: 'left' })
  if (type === 'cards') Object.assign(settings, { title: 'Título da seção', items: [{ id: newId(), title: 'Cartão', text: '', image: '', href: '' }] })
  if (type === 'imageText') Object.assign(settings, { title: 'Conte uma história', text: 'Escreva aqui.', imageSide: 'right', buttonLabel: '', buttonHref: '' })
  if (type === 'faq') Object.assign(settings, { title: 'Perguntas frequentes', items: [{ id: newId(), title: 'Qual é a pergunta?', text: 'Escreva a resposta aqui.', image: '', href: '' }] })
  if (type === 'collection') Object.assign(settings, { title: 'Os mais vendidos', collection: 'mais-vendidos', buttonLabel: 'Ver a coleção completa' })
  if (type === 'cta') Object.assign(settings, { title: 'Pronto para garimpar?', text: '', buttonLabel: 'Ver ofertas', buttonHref: '/buscar', tone: 'dark' })
  if (type === 'spacer') settings.height = 48
  return { id: newId(), type, name: definition.label, hidden: false, archived: false, settings }
}

/** Valores de `home` (Painel → Home, versão antiga) que alimentam o documento padrão. */
type HomeSetting = Record<string, unknown>
const homeText = (home: HomeSetting, key: string, fallback: string) => typeof home[key] === 'string' && (home[key] as string).trim() ? String(home[key]) : fallback

/** Documento que reproduz a home de antes do editor, respeitando ordem e visibilidade salvas em `home`. */
/** Coleções que a home mostra logo abaixo da vitrine principal (escolhidas para não repetir os filtros dela). */
export const homeCollections = [
  { slug: 'viralizou', name: 'Coleção: Viralizou' },
  { slug: 'queridinhos', name: 'Coleção: Queridinhos' },
  { slug: 'achadinhos', name: 'Coleção: Achadinhos' },
  { slug: 'custo-beneficio', name: 'Coleção: Custo-benefício' },
  { slug: 'desconto-pesado', name: 'Coleção: Desconto pesado' },
] as const

export function defaultHomeDocument(home: HomeSetting = {}): SiteDocument {
  const order = (Array.isArray(home.sectionOrder) ? home.sectionOrder.map(String) : ['catalog', 'selections', 'guides', 'howItWorks'])
    .filter((id): id is 'catalog' | 'selections' | 'guides' | 'howItWorks' => ['catalog', 'selections', 'guides', 'howItWorks'].includes(id))
  for (const id of ['catalog', 'selections', 'guides', 'howItWorks'] as const) if (!order.includes(id)) order.push(id)
  const hidden = (id: string) => home[`show_${id}`] === false
  const settingsFor: Record<string, SectionSettings> = {
    catalog: {},
    selections: {},
    guides: { title: 'Antes de comprar.', text: '', buttonLabel: 'Todos os guias' },
    howItWorks: { title: 'Você escolhe.\nA gente ajuda a encontrar.', text: '', buttonLabel: 'Como funciona' },
  }
  return {
    schemaVersion: 1,
    sections: [
      {
        id: 'hero', type: 'hero', name: sectionTypes.hero.label, hidden: false, archived: false,
        settings: {
          title: homeText(home, 'heroTitle', 'Bons produtos.'), accent: homeText(home, 'heroAccent', 'Preços que valem.'),
          text: homeText(home, 'heroLead', ''),
          buttonLabel: homeText(home, 'ctaLabel', 'Ver ofertas'),
        },
      },
      { id: 'campaign', type: 'campaign', name: sectionTypes.campaign.label, hidden: false, archived: false, settings: {} },
      ...order.flatMap((id): Section[] => {
        const section: Section = { id, type: id, name: sectionTypes[id].label, hidden: hidden(id) || id === 'howItWorks', archived: false, settings: settingsFor[id] }
        if (id !== 'catalog') return [section]
        // Cada coleção é um bloco próprio (título e texto seguem a regra da coleção); some sozinho se ela ficar vazia.
        const collections = homeCollections.map(({ slug, name }): Section => ({
          id: `colecao-${slug}`, type: 'collection', name, hidden: hidden('collections'), archived: false,
          settings: { collection: slug, count: 8, buttonLabel: 'Ver coleção' },
        }))
        return [section, ...collections]
      }),
    ],
  }
}

// ---------------------------------------------------------------- páginas criadas no editor

export const GLOBAL_KEY = 'global'
export const PAGE_PREFIX = 'page:'
export const pageSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_SLUG = 60

export const pageKeyFor = (slug: string) => `${PAGE_PREFIX}${slug}`
export const isPageKey = (key: string) => key.startsWith(PAGE_PREFIX) && key.length <= PAGE_PREFIX.length + MAX_SLUG && pageSlugPattern.test(key.slice(PAGE_PREFIX.length))
export const slugOfKey = (key: string) => isPageKey(key) ? key.slice(PAGE_PREFIX.length) : null

/** "Dia das Mães 2026!" → "dia-das-maes-2026". */
export function slugify(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG).replace(/-+$/g, '')
}

/** Ponto de partida de uma página nova: um bloco de texto com o título. */
export function starterPageDocument(title: string): SiteDocument {
  const text = newSection('text')
  return { schemaVersion: 1, sections: [{ ...text, settings: { ...text.settings, title } }], page: { title } }
}

// ---------------------------------------------------------------- validação

function normalizeVisuals(type: SectionType, source: Record<string, unknown>, path: string, errors: DocumentErrors, settings: SectionSettings) {
  const builtin = sectionTypes[type].builtin
  if (typeof source.background === 'string' && source.background) {
    if (!isHex(source.background)) errors[`${path}.background`] = 'Use uma cor no formato #rrggbb.'
    // Seções do site mantêm o texto escuro da vitrine: um fundo escuro as deixaria ilegíveis.
    else if (builtin && !isLightEnough(source.background)) errors[`${path}.background`] = 'Fundo escuro demais: esta seção usa texto escuro. Escolha um fundo claro.'
    else settings.background = source.background.toLowerCase()
  }
  if (!builtin && typeof source.color === 'string' && source.color) {
    if (!isHex(source.color)) errors[`${path}.color`] = 'Use uma cor no formato #rrggbb.'
    else settings.color = source.color.toLowerCase()
  }
  if (source.padding !== undefined && source.padding !== null && source.padding !== '') {
    const padding = Number(source.padding)
    if (Number.isFinite(padding)) settings.padding = Math.min(Math.max(Math.round(padding), 0), MAX_PADDING)
  }
  if (source.width === 'full' || source.width === 'contained') settings.width = source.width
}

function normalizeSettings(type: SectionType, raw: unknown, path: string, errors: DocumentErrors): SectionSettings {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const settings: SectionSettings = {}
  for (const field of sectionTypes[type].fields) {
    const value = source[field.key as string]
    switch (field.kind) {
      case 'text':
      case 'textarea':
      case 'markdown': {
        const text = clip(value, field.maxLength ?? 500)
        if (typeof value === 'string' && value.trim().length > (field.maxLength ?? 500)) errors[`${path}.${field.key}`] = `No máximo ${field.maxLength} caracteres.`
        if (text) (settings as Record<string, unknown>)[field.key] = text
        break
      }
      case 'url': {
        const text = clip(value, 2048)
        if (text && !safeLink(text)) errors[`${path}.${field.key}`] = 'Use um caminho do site (/colecoes) ou um endereço https.'
        else if (text) (settings as Record<string, unknown>)[field.key] = text
        break
      }
      case 'image': {
        const text = clip(value, 2048)
        if (text && !safeImage(text)) errors[`${path}.${field.key}`] = 'Use uma imagem https ou um caminho do site.'
        else if (text) (settings as Record<string, unknown>)[field.key] = text
        break
      }
      case 'select': {
        const option = field.options?.find((item) => item.value === value)
        if (option) (settings as Record<string, unknown>)[field.key] = option.value
        break
      }
      case 'number': {
        const number = Number(value)
        if (Number.isFinite(number)) (settings as Record<string, unknown>)[field.key] = Math.min(Math.max(Math.round(number), field.min ?? 0), field.max ?? 400)
        break
      }
      case 'collection': {
        const text = clip(value, 80)
        if (text && !pageSlugPattern.test(text)) errors[`${path}.${field.key}`] = 'Escolha uma coleção da lista.'
        else if (text) settings.collection = text
        break
      }
      case 'items': {
        const faq = field.variant === 'faq'
        const textMax = field.maxLength ?? 300
        const list = Array.isArray(value) ? value.slice(0, MAX_ITEMS) : []
        settings.items = list.map((entry, index): SectionItem => {
          const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
          const image = faq ? '' : clip(item.image, 2048)
          const href = faq ? '' : clip(item.href, 2048)
          if (image && !safeImage(image)) errors[`${path}.items.${index}.image`] = 'Use uma imagem https ou um caminho do site.'
          if (href && !safeLink(href)) errors[`${path}.items.${index}.href`] = 'Use um caminho do site ou um endereço https.'
          return {
            id: clip(item.id, 40).replace(/[^\w-]/g, '') || newId(),
            title: clip(item.title, faq ? 140 : 90), text: clip(item.text, textMax),
            image: image && safeImage(image) ? image : '', href: href && safeLink(href) ? href : '',
          }
        })
        break
      }
    }
  }
  normalizeVisuals(type, source, path, errors, settings)
  return settings
}

export type NormalizeOptions = {
  /** O documento `global` não tem seções (só `design`). */
  allowEmpty?: boolean
}

/** Valida e normaliza um documento recebido. Campos desconhecidos são descartados. */
export function normalizeDocument(input: unknown, options: NormalizeOptions = {}): { value: SiteDocument } | { errors: DocumentErrors } {
  const errors: DocumentErrors = {}
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : null
  if (!source || !Array.isArray(source.sections)) return { errors: { sections: 'Documento inválido.' } }
  if (source.sections.length > MAX_SECTIONS) return { errors: { sections: `No máximo ${MAX_SECTIONS} seções.` } }

  const seen = new Set<string>()
  const builtinSeen = new Set<SectionType>()
  const sections: Section[] = []
  source.sections.forEach((entry, index) => {
    const raw = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
    const type = sectionTypeList.find((candidate) => candidate === raw.type)
    const path = `sections.${index}`
    if (!type) { errors[path] = 'Tipo de seção desconhecido.'; return }
    let id = clip(raw.id, 60).replace(/[^\w-]/g, '') || newId()
    if (seen.has(id)) id = newId()
    seen.add(id)
    if (sectionTypes[type].builtin) {
      if (builtinSeen.has(type)) { errors[path] = `A seção "${sectionTypes[type].label}" só pode aparecer uma vez.`; return }
      builtinSeen.add(type)
    }
    sections.push({
      id, type, name: clip(raw.name, 80) || sectionTypes[type].label, hidden: raw.hidden === true, archived: raw.archived === true,
      settings: normalizeSettings(type, raw.settings, `${path}.settings`, errors),
    })
  })
  if (!errors.sections && sections.length === 0 && !options.allowEmpty) errors.sections = 'A página precisa de pelo menos uma seção.'

  const value: SiteDocument = { schemaVersion: 1, sections }

  if (source.page && typeof source.page === 'object') {
    const page = source.page as Record<string, unknown>
    const title = clip(page.title, 70)
    const description = clip(page.description, 160)
    if (title || description) value.page = { ...(title ? { title } : {}), ...(description ? { description } : {}) }
  }
  if (source.design && typeof source.design === 'object') value.design = normalizeDesign(source.design, 'design', errors)

  return Object.keys(errors).length ? { errors } : { value }
}

/** Seções internas que o documento ainda não tem (podem ser adicionadas de novo). Arquivadas contam como presentes. */
export const missingBuiltins = (document: SiteDocument) =>
  sectionTypeList.filter((type) => sectionTypes[type].builtin && !document.sections.some((section) => section.type === type))

/** Seções que aparecem na página (nem ocultas, nem arquivadas). */
export const visibleSections = (document: SiteDocument) => document.sections.filter((section) => !section.hidden && !section.archived)

/** Copia os textos preenchidos da variante B de um teste A/B para a seção do topo. Campos em branco ficam como estão. */
export function applyHeroCopy(document: SiteDocument, copy: { title?: string; accent?: string; text?: string; buttonLabel?: string }): SiteDocument {
  const patch: SectionSettings = {}
  if (copy.title) patch.title = copy.title
  if (copy.accent) patch.accent = copy.accent
  if (copy.text) patch.text = copy.text
  if (copy.buttonLabel) patch.buttonLabel = copy.buttonLabel
  return { ...document, sections: document.sections.map((section) => section.type === 'hero' ? { ...section, settings: { ...section.settings, ...patch } } : section) }
}
