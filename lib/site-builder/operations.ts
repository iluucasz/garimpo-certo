/**
 * Operações do editor sobre um documento. Funções puras: recebem o documento e devolvem outro (nunca mexem
 * no original), para o histórico de desfazer/refazer e os testes não dependerem de React.
 */
import { MAX_SECTIONS, newId, newSection, sectionTypes, type Section, type SectionSettings, type SectionType, type SiteDocument } from './document'

const withSections = (document: SiteDocument, sections: Section[]): SiteDocument => ({ ...document, sections })
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const findSection = (document: SiteDocument, id: string | null) => (id ? document.sections.find((section) => section.id === id) ?? null : null)

/** Seção nova do tipo pedido. Interna reaproveita a que já está arquivada (não duplica). */
export function createSection(document: SiteDocument, type: SectionType): Section | null {
  if (sectionTypes[type].builtin) {
    if (document.sections.some((section) => section.type === type)) return null
    return { id: type, type, name: sectionTypes[type].label, hidden: false, archived: false, settings: {} }
  }
  return newSection(type)
}

/** Insere antes de `beforeId`; `null` coloca no fim. Devolve `null` se estourar o limite de seções. */
export function insertSection(document: SiteDocument, section: Section, beforeId: string | null): SiteDocument | null {
  if (document.sections.length >= MAX_SECTIONS) return null
  const index = beforeId ? document.sections.findIndex((item) => item.id === beforeId) : -1
  const at = index < 0 ? document.sections.length : index
  return withSections(document, [...document.sections.slice(0, at), section, ...document.sections.slice(at)])
}

/** Move a seção para antes de `beforeId` (ou para o fim, com `null`). */
export function moveSection(document: SiteDocument, id: string, beforeId: string | null): SiteDocument {
  if (id === beforeId) return document
  const moving = document.sections.find((section) => section.id === id)
  if (!moving) return document
  const rest = document.sections.filter((section) => section.id !== id)
  const index = beforeId ? rest.findIndex((section) => section.id === beforeId) : -1
  const at = index < 0 ? rest.length : index
  const next = [...rest.slice(0, at), moving, ...rest.slice(at)]
  return next.every((section, position) => section === document.sections[position]) ? document : withSections(document, next)
}

/**
 * Sobe (-1) ou desce (+1) a seção por uma posição **entre as que aparecem na lista de trabalho**
 * (as arquivadas não contam, para o botão nunca "não fazer nada").
 */
export function moveBy(document: SiteDocument, id: string, delta: -1 | 1): SiteDocument {
  const active = document.sections.filter((section) => !section.archived)
  const position = active.findIndex((section) => section.id === id)
  const target = position + delta
  if (position < 0 || target < 0 || target >= active.length) return document
  const neighbour = active[target]
  const from = document.sections.findIndex((section) => section.id === id)
  const to = document.sections.findIndex((section) => section.id === neighbour.id)
  const next = [...document.sections]
  ;[next[from], next[to]] = [next[to], next[from]]
  return withSections(document, next)
}

export function updateSection(document: SiteDocument, id: string, patch: Partial<Omit<Section, 'id' | 'type' | 'settings'>>): SiteDocument {
  return withSections(document, document.sections.map((section) => section.id === id ? { ...section, ...patch } : section))
}

/** `undefined` em um campo remove a configuração (volta ao padrão do tema). */
export function updateSettings(document: SiteDocument, id: string, patch: Partial<Record<keyof SectionSettings, unknown>>): SiteDocument {
  return withSections(document, document.sections.map((section) => {
    if (section.id !== id) return section
    const settings = { ...section.settings } as Record<string, unknown>
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete settings[key]
      else settings[key] = value
    }
    return { ...section, settings: settings as SectionSettings }
  }))
}

/** Cópia logo depois da original. Seções internas não duplicam (só podem existir uma vez). */
export function duplicateSection(document: SiteDocument, id: string): { document: SiteDocument; copy: Section } | null {
  const original = findSection(document, id)
  if (!original || sectionTypes[original.type].builtin || document.sections.length >= MAX_SECTIONS) return null
  const settings = clone(original.settings)
  if (settings.items) settings.items = settings.items.map((item) => ({ ...item, id: newId() }))
  const copy: Section = { ...original, id: newId(), name: `${original.name} (cópia)`, settings }
  const index = document.sections.findIndex((section) => section.id === id)
  return { document: withSections(document, [...document.sections.slice(0, index + 1), copy, ...document.sections.slice(index + 1)]), copy }
}

export const archiveSection = (document: SiteDocument, id: string) => updateSection(document, id, { archived: true })
export const restoreSection = (document: SiteDocument, id: string) => updateSection(document, id, { archived: false, hidden: false })

/** Exclusão definitiva: só a partir das arquivadas, depois de confirmar. */
export const deleteSection = (document: SiteDocument, id: string) => withSections(document, document.sections.filter((section) => section.id !== id))

/** Primeira seção da lista de trabalho depois de `id` sair dela (para manter algo selecionado). */
export function neighbourAfterRemoval(document: SiteDocument, id: string): string | null {
  const active = document.sections.filter((section) => !section.archived)
  const index = active.findIndex((section) => section.id === id)
  return (active[index + 1] ?? active[index - 1])?.id ?? null
}

export const sameDocument = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
