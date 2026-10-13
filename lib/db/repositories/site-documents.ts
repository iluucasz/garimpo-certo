import { eq } from 'drizzle-orm'
import { cachedQuery } from '@/lib/db/cached'
import { db } from '@/lib/db/client'
import { siteDocuments } from '@/lib/db/schema'
import { getSetting } from '@/lib/settings'
import { defaultHomeDocument, normalizeDocument, type SiteDocument } from '@/lib/site-builder/document'

/** Páginas que o painel deixa montar. Hoje só a home; o repositório aceita qualquer chave (os testes usam chaves próprias). */
export const documentKeys = ['home'] as const
export type DocumentKey = string
export const isDocumentKey = (value: string) => (documentKeys as readonly string[]).includes(value)

export const HISTORY_LIMIT = 15
export const DOCUMENT_TAG = 'site-documents'

export type HistoryEntry = { id: string; at: string; by: string | null; document: SiteDocument }

type Row = typeof siteDocuments.$inferSelect

/** Lê e revalida o que veio do banco: um documento que não passa na validação é tratado como ausente. */
function parse(value: unknown): SiteDocument | null {
  if (!value) return null
  const result = normalizeDocument(value)
  return 'value' in result ? result.value : null
}

async function loadRow(key: DocumentKey): Promise<Row | null> {
  const [row] = await db.select().from(siteDocuments).where(eq(siteDocuments.key, key)).limit(1)
  return row ?? null
}

/** A home é lida a cada visita: usa o cache de dados (5 min) com invalidação por tag ao publicar. */
const homePublished = cachedQuery(async () => parse((await loadRow('home'))?.published), ['site-document-home-published-v1'], [DOCUMENT_TAG, 'settings'])
const readPublished = async (key: DocumentKey) => key === 'home' ? homePublished() : parse((await loadRow(key))?.published)

/**
 * Documento que a página deve renderizar. Sem publicação, o padrão derivado das configurações da home
 * (comportamento anterior ao editor). Com `preview`, o rascunho em vez do publicado: só para quem edita.
 */
export async function getRenderDocument(key: DocumentKey, options: { preview?: boolean } = {}): Promise<SiteDocument> {
  try {
    if (options.preview) {
      const row = await loadRow(key)
      const draft = parse(row?.draft)
      if (draft) return draft
      const published = parse(row?.published)
      if (published) return published
    } else {
      const published = await readPublished(key)
      if (published) return published
    }
  } catch (error) {
    console.error(`[site-documents] falha ao ler "${key}"; usando o padrão`, error instanceof Error ? error.message : error)
  }
  return defaultHomeDocument(await getSetting('home'))
}

export type EditorState = {
  key: DocumentKey
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
  const [row, home] = await Promise.all([loadRow(key), getSetting('home')])
  const fallback = defaultHomeDocument(home)
  const draft = parse(row?.draft)
  const published = parse(row?.published)
  const history = ((row?.history ?? []) as HistoryEntry[]).filter((entry) => entry && entry.id && parse(entry.document))
  return {
    key,
    document: draft ?? published ?? fallback,
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
  const draft = parse(row?.draft)
  const previous = parse(row?.published)
  const toPublish = draft ?? previous ?? defaultHomeDocument(await getSetting('home'))
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
  const document = parse(entry?.document)
  if (!document) return null
  await saveDraft(key, document, userId)
  return document
}
