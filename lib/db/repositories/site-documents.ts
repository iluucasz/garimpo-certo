import { eq, like } from 'drizzle-orm'
import { cachedQuery } from '@/lib/db/cached'
import { db } from '@/lib/db/client'
import { siteDocuments } from '@/lib/db/schema'
import { getSetting } from '@/lib/settings'
import { defaultDesign, type SiteDesign } from '@/lib/site-builder/design'
import {
  defaultHomeDocument, GLOBAL_KEY, isPageKey, normalizeDocument, pageKeyFor, PAGE_PREFIX, slugOfKey, starterPageDocument,
  type SiteDocument,
} from '@/lib/site-builder/document'

/**
 * Chaves aceitas pelo editor: `home`, `global` (aparência do site: tema, aviso e rodapé) e `page:<endereço>`
 * (páginas criadas no painel). O repositório em si aceita qualquer chave (os testes usam chaves próprias).
 */
export type DocumentKey = string
export const isDocumentKey = (value: string) => value === 'home' || value === GLOBAL_KEY || isPageKey(value)

export const HISTORY_LIMIT = 30
export const DOCUMENT_TAG = 'site-documents'

export type HistoryEntry = { id: string; at: string; by: string | null; document: SiteDocument }

type Row = typeof siteDocuments.$inferSelect

/** O documento `global` não tem seções; todos os outros precisam de pelo menos uma. */
const parseOptions = (key: DocumentKey) => ({ allowEmpty: key === GLOBAL_KEY })

/** Lê e revalida o que veio do banco: um documento que não passa na validação é tratado como ausente. */
function parse(value: unknown, key: DocumentKey): SiteDocument | null {
  if (!value) return null
  const result = normalizeDocument(value, parseOptions(key))
  return 'value' in result ? result.value : null
}

async function loadRow(key: DocumentKey): Promise<Row | null> {
  const [row] = await db.select().from(siteDocuments).where(eq(siteDocuments.key, key)).limit(1)
  return row ?? null
}

/** O que a página mostra quando nada foi publicado (a home e o design global derivam das configurações antigas). */
async function fallbackFor(key: DocumentKey): Promise<SiteDocument> {
  if (key === GLOBAL_KEY) return { schemaVersion: 1, sections: [], design: defaultDesign(await getSetting('theme')) }
  if (isPageKey(key)) return starterPageDocument(slugOfKey(key) ?? 'Nova página')
  return defaultHomeDocument(await getSetting('home'))
}

/** O que o público vê é lido a cada visita: cache de dados (5 min) com invalidação por tag ao publicar. */
const readPublished = (key: DocumentKey) => cachedQuery(async () => parse((await loadRow(key))?.published, key), ['site-document-published-v2', key], [DOCUMENT_TAG, 'settings'])()

/**
 * Documento que a página deve renderizar. Sem publicação, o padrão derivado das configurações da home
 * (comportamento anterior ao editor). Com `preview`, o rascunho em vez do publicado: só para quem edita.
 */
export async function getRenderDocument(key: DocumentKey, options: { preview?: boolean } = {}): Promise<SiteDocument> {
  try {
    if (options.preview) {
      const row = await loadRow(key)
      const draft = parse(row?.draft, key)
      if (draft) return draft
      const published = parse(row?.published, key)
      if (published) return published
    } else {
      const published = await readPublished(key)
      if (published) return published
    }
  } catch (error) {
    console.error(`[site-documents] falha ao ler "${key}"; usando o padrão`, error instanceof Error ? error.message : error)
  }
  return fallbackFor(key)
}

/** Página criada no painel, ou `null` quando não existe ou não foi publicada (na prévia, vale o rascunho). */
export async function getPageDocument(slug: string, options: { preview?: boolean } = {}): Promise<SiteDocument | null> {
  const key = pageKeyFor(slug)
  if (!isPageKey(key)) return null
  try {
    if (options.preview) {
      const row = await loadRow(key)
      return parse(row?.draft, key) ?? parse(row?.published, key)
    }
    return await readPublished(key)
  } catch (error) {
    console.error(`[site-documents] falha ao ler a página "${slug}"`, error instanceof Error ? error.message : error)
    return null
  }
}

/** Design global publicado; sem publicação, o derivado de Configurações → Tema. Com `preview`, o rascunho. */
export async function getSiteDesign(options: { preview?: boolean } = {}): Promise<SiteDesign> {
  const document = await getRenderDocument(GLOBAL_KEY, options)
  return document.design ?? defaultDesign(await getSetting('theme'))
}

export type EditorState = {
  key: DocumentKey
  kind: 'home' | 'global' | 'page'
  slug: string | null
  /** O que o editor mostra: rascunho, ou o publicado, ou o padrão. */
  document: SiteDocument
  /** O que o site mostra hoje. */
  published: SiteDocument
  hasDraft: boolean
  isDefault: boolean
  draftUpdatedAt: string | null
  publishedAt: string | null
  history: { id: string; at: string; by: string | null; sections: number }[]
}

export async function getEditorState(key: DocumentKey): Promise<EditorState> {
  const [row, fallback] = await Promise.all([loadRow(key), fallbackFor(key)])
  const draft = parse(row?.draft, key)
  const published = parse(row?.published, key)
  const history = ((row?.history ?? []) as HistoryEntry[]).filter((entry) => entry && entry.id && parse(entry.document, key))
  return {
    key,
    kind: key === GLOBAL_KEY ? 'global' : isPageKey(key) ? 'page' : 'home',
    slug: slugOfKey(key),
    document: draft ?? published ?? fallback,
    // Página nova que nunca foi publicada não tem "publicado": o painel mostra como não publicada.
    published: published ?? fallback,
    hasDraft: Boolean(draft),
    isDefault: !published,
    draftUpdatedAt: row?.draftUpdatedAt ?? null,
    publishedAt: row?.publishedAt ?? null,
    history: history.map((entry) => ({ id: entry.id, at: entry.at, by: entry.by, sections: entry.document.sections.length })),
  }
}

const now = () => new Date().toISOString()

async function upsert(key: DocumentKey, values: Partial<typeof siteDocuments.$inferInsert>) {
  await db.insert(siteDocuments).values({ key, ...values })
    .onConflictDoUpdate({ target: siteDocuments.key, set: values })
}

export async function saveDraft(key: DocumentKey, document: SiteDocument, userId: string | null) {
  await upsert(key, { draft: document, draftUpdatedAt: now(), updatedBy: userId })
}

export async function discardDraft(key: DocumentKey, userId: string | null) {
  await upsert(key, { draft: null, draftUpdatedAt: null, updatedBy: userId })
}

/** Publica o rascunho (ou o documento padrão, se nunca houve rascunho) e guarda a versão anterior no histórico. */
export async function publishDraft(key: DocumentKey, userId: string | null) {
  const row = await loadRow(key)
  const draft = parse(row?.draft, key)
  const previous = parse(row?.published, key)
  const toPublish = draft ?? previous ?? await fallbackFor(key)
  const history = ((row?.history ?? []) as HistoryEntry[])
  const next = previous
    ? [{ id: crypto.randomUUID(), at: row?.publishedAt ?? now(), by: row?.updatedBy ?? null, document: previous }, ...history].slice(0, HISTORY_LIMIT)
    : history
  await upsert(key, { published: toPublish, publishedAt: now(), draft: null, draftUpdatedAt: null, history: next, updatedBy: userId })
  return toPublish
}

/** Coloca uma versão do histórico no rascunho. Não publica: a pessoa confere e publica. */
export async function restoreVersion(key: DocumentKey, versionId: string, userId: string | null) {
  const row = await loadRow(key)
  const entry = ((row?.history ?? []) as HistoryEntry[]).find((item) => item.id === versionId)
  const document = parse(entry?.document, key)
  if (!document) return null
  await saveDraft(key, document, userId)
  return document
}

// ---------------------------------------------------------------- páginas criadas no painel

export type PageSummary = {
  key: DocumentKey
  slug: string
  title: string
  published: boolean
  hasDraft: boolean
  updatedAt: string | null
  publishedAt: string | null
}

const titleOf = (key: DocumentKey, draft: SiteDocument | null, published: SiteDocument | null) =>
  published?.page?.title || draft?.page?.title || (slugOfKey(key) ?? key)

/** Todas as páginas criadas no painel (rascunhos e publicadas), mais recentes primeiro. */
export async function listPages(): Promise<PageSummary[]> {
  const rows = await db.select().from(siteDocuments).where(like(siteDocuments.key, `${PAGE_PREFIX}%`))
  return rows
    .filter((row) => isPageKey(row.key))
    .map((row): PageSummary => {
      const draft = parse(row.draft, row.key)
      const published = parse(row.published, row.key)
      return {
        key: row.key, slug: slugOfKey(row.key)!, title: titleOf(row.key, draft, published),
        published: Boolean(published), hasDraft: Boolean(draft), updatedAt: row.draftUpdatedAt ?? row.publishedAt, publishedAt: row.publishedAt,
      }
    })
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

/** Páginas publicadas (para o sitemap). */
export const listPublishedPages = cachedQuery(
  async () => (await listPages()).filter((page) => page.published).map((page) => ({ slug: page.slug, title: page.title, publishedAt: page.publishedAt })),
  ['site-document-pages-v1'], [DOCUMENT_TAG],
)

/** Cria a página com um bloco de texto como ponto de partida. `null` se o endereço já existe. */
export async function createPage(slug: string, title: string, userId: string | null): Promise<PageSummary | null> {
  const key = pageKeyFor(slug)
  if (!isPageKey(key) || await loadRow(key)) return null
  await upsert(key, { draft: starterPageDocument(title), draftUpdatedAt: now(), updatedBy: userId })
  return (await listPages()).find((page) => page.key === key) ?? null
}

/** Tira a página do ar, mantendo o conteúdo como rascunho. */
export async function unpublishPage(key: DocumentKey, userId: string | null) {
  const row = await loadRow(key)
  if (!isPageKey(key) || !row) return false
  const published = parse(row.published, key)
  const draft = parse(row.draft, key)
  await upsert(key, { published: null, publishedAt: null, draft: draft ?? published, draftUpdatedAt: draft ? row.draftUpdatedAt : now(), updatedBy: userId })
  return true
}

/** Apaga uma página que não está no ar. Retorna `false` se estiver publicada (despublique antes) ou não existir. */
export async function deletePage(key: DocumentKey): Promise<boolean> {
  const row = await loadRow(key)
  if (!isPageKey(key) || !row || parse(row.published, key)) return false
  await db.delete(siteDocuments).where(eq(siteDocuments.key, key))
  return true
}
