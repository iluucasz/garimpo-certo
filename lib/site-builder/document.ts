/**
 * Documento do editor visual de páginas (Painel → Home).
 *
 * Uma página é uma lista ordenada de seções. Há dois tipos:
 *  - **internas**: já existem no site e puxam dado real (vitrine, coleções, guias, campanha). A equipe muda
 *    a ordem, esconde e ajusta os textos, mas o conteúdo continua vindo do catálogo;
 *  - **blocos livres**: banner, texto, cartões, imagem, chamada e espaçador, só com o que a pessoa escreveu.
 *
 * Isomórfico: o painel desenha o formulário de cada seção a partir de `sectionTypes`, e o servidor valida o
 * mesmo documento com `normalizeDocument`. Sem documento publicado, o site usa `defaultHomeDocument`, que
 * reproduz exatamente a home de antes do editor.
 */

export type SectionType =
  | 'hero' | 'campaign' | 'catalog' | 'selections' | 'guides' | 'howItWorks'
  | 'banner' | 'text' | 'cards' | 'image' | 'cta' | 'spacer'

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
}

export type Section = { id: string; type: SectionType; name: string; hidden: boolean; settings: SectionSettings }
export type SiteDocument = { schemaVersion: 1; sections: Section[] }

export type FieldKind = 'text' | 'textarea' | 'markdown' | 'url' | 'image' | 'select' | 'number' | 'items'
export type SectionField = {
  key: keyof SectionSettings
  label: string
  kind: FieldKind
  help?: string
  maxLength?: number
  options?: { value: string; label: string }[]
  min?: number
  max?: number
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
    description: 'Explica que a compra é na loja parceira e que o site pode receber comissão.',
    fields: [
      { key: 'title', label: 'Título', kind: 'textarea', maxLength: 100, help: 'Use uma nova linha para quebrar o título.' },
      { key: 'text', label: 'Texto', kind: 'textarea', maxLength: 400, help: 'Mantenha a menção a links de afiliado.' },
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
      { key: 'items', label: 'Cartões', kind: 'items' },
    ],
  },
  image: {
    type: 'image', label: 'Imagem', builtin: false,
    description: 'Uma imagem, com link opcional.',
    fields: [
      { key: 'image', label: 'Imagem', kind: 'image' },
      { key: 'alt', label: 'Descrição da imagem', kind: 'text', maxLength: 140 },
      { key: 'buttonHref', label: 'Link da imagem', kind: 'url' },
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

export const newId = () => `s_${Math.random().toString(36).slice(2, 10)}`

export function newSection(type: SectionType): Section {
  const definition = sectionTypes[type]
  const settings: SectionSettings = {}
  if (type === 'banner') Object.assign(settings, { title: 'Título do banner', text: '', buttonLabel: 'Saiba mais', buttonHref: '/colecoes', align: 'left', tone: 'soft' })
  if (type === 'text') Object.assign(settings, { title: 'Título', text: 'Escreva aqui.', align: 'left' })
  if (type === 'cards') Object.assign(settings, { title: 'Título da seção', items: [{ id: newId(), title: 'Cartão', text: '', image: '', href: '' }] })
  if (type === 'cta') Object.assign(settings, { title: 'Pronto para garimpar?', text: '', buttonLabel: 'Ver ofertas', buttonHref: '/buscar', tone: 'dark' })
  if (type === 'spacer') settings.height = 48
  return { id: newId(), type, name: definition.label, hidden: false, settings }
}

/** Valores de `home` (Painel → Home, versão antiga) que alimentam o documento padrão. */
type HomeSetting = Record<string, unknown>
const homeText = (home: HomeSetting, key: string, fallback: string) => typeof home[key] === 'string' && (home[key] as string).trim() ? String(home[key]) : fallback

/** Documento que reproduz a home de antes do editor, respeitando ordem e visibilidade salvas em `home`. */
export function defaultHomeDocument(home: HomeSetting = {}): SiteDocument {
  const order = (Array.isArray(home.sectionOrder) ? home.sectionOrder.map(String) : ['catalog', 'selections', 'guides', 'howItWorks'])
    .filter((id): id is 'catalog' | 'selections' | 'guides' | 'howItWorks' => ['catalog', 'selections', 'guides', 'howItWorks'].includes(id))
  for (const id of ['catalog', 'selections', 'guides', 'howItWorks'] as const) if (!order.includes(id)) order.push(id)
  const hidden = (id: string) => home[`show_${id}`] === false
  const settingsFor: Record<string, SectionSettings> = {
    catalog: {},
    selections: {},
    guides: { title: 'Antes de comprar.', text: 'O que conferir em cada categoria, com os destaques de hoje do catálogo.', buttonLabel: 'Todos os guias' },
    howItWorks: {
      title: 'Você escolhe.\nA gente ajuda a encontrar.',
      text: 'Compare ofertas, salve seus favoritos e finalize a compra na loja parceira. Podemos receber uma comissão pelos links de afiliados.',
      buttonLabel: 'Como o Garimpo funciona',
    },
  }
  return {
    schemaVersion: 1,
    sections: [
      {
        id: 'hero', type: 'hero', name: sectionTypes.hero.label, hidden: false,
        settings: {
          title: homeText(home, 'heroTitle', 'Bons produtos.'), accent: homeText(home, 'heroAccent', 'Preços que valem.'),
          text: homeText(home, 'heroLead', 'Encontre seu próximo achado e compre direto na loja com a melhor oferta disponível.'),
          buttonLabel: homeText(home, 'ctaLabel', 'Ver ofertas'),
        },
      },
      { id: 'campaign', type: 'campaign', name: sectionTypes.campaign.label, hidden: false, settings: {} },
      ...order.map((id): Section => ({ id, type: id, name: sectionTypes[id].label, hidden: hidden(id), settings: settingsFor[id] })),
    ],
  }
}

// ---------------------------------------------------------------- validação

const safeLink = (value: string) => !/[\s\\]/.test(value) && (/^https:\/\/[^/\s]+/i.test(value) || /^\/(?!\/)/.test(value) || /^#[a-z][\w-]*$/i.test(value))
const safeImage = (value: string) => !/[\s\\]/.test(value) && (/^https:\/\/[^/\s]+/i.test(value) || /^\/(?!\/)/.test(value))

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '')

export type DocumentErrors = Record<string, string>

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
        if (Number.isFinite(number)) settings.height = Math.min(Math.max(Math.round(number), field.min ?? 0), field.max ?? 400)
        break
      }
      case 'items': {
        const list = Array.isArray(value) ? value.slice(0, MAX_ITEMS) : []
        settings.items = list.map((entry, index): SectionItem => {
          const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
          const image = clip(item.image, 2048)
          const href = clip(item.href, 2048)
          if (image && !safeImage(image)) errors[`${path}.items.${index}.image`] = 'Use uma imagem https ou um caminho do site.'
          if (href && !safeLink(href)) errors[`${path}.items.${index}.href`] = 'Use um caminho do site ou um endereço https.'
          return { id: clip(item.id, 40) || newId(), title: clip(item.title, 90), text: clip(item.text, 300), image: image && safeImage(image) ? image : '', href: href && safeLink(href) ? href : '' }
        })
        break
      }
    }
  }
  return settings
}

/** Valida e normaliza um documento recebido. Campos desconhecidos são descartados. */
export function normalizeDocument(input: unknown): { value: SiteDocument } | { errors: DocumentErrors } {
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
      id, type, name: clip(raw.name, 80) || sectionTypes[type].label, hidden: raw.hidden === true,
      settings: normalizeSettings(type, raw.settings, `${path}.settings`, errors),
    })
  })
  if (!errors.sections && sections.length === 0) errors.sections = 'A página precisa de pelo menos uma seção.'
  return Object.keys(errors).length ? { errors } : { value: { schemaVersion: 1, sections } }
}

/** Seções internas que o documento ainda não tem (podem ser adicionadas de novo). */
export const missingBuiltins = (document: SiteDocument) =>
  sectionTypeList.filter((type) => sectionTypes[type].builtin && !document.sections.some((section) => section.type === type))

/** Copia os textos preenchidos da variante B de um teste A/B para a seção do topo. Campos em branco ficam como estão. */
export function applyHeroCopy(document: SiteDocument, copy: { title?: string; accent?: string; text?: string; buttonLabel?: string }): SiteDocument {
  const patch: SectionSettings = {}
  if (copy.title) patch.title = copy.title
  if (copy.accent) patch.accent = copy.accent
  if (copy.text) patch.text = copy.text
  if (copy.buttonLabel) patch.buttonLabel = copy.buttonLabel
  return { ...document, sections: document.sections.map((section) => section.type === 'hero' ? { ...section, settings: { ...section.settings, ...patch } } : section) }
}
