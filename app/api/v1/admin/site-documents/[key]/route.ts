import { recordAudit } from '@/lib/admin/audit'
import { invalidate } from '@/lib/db/invalidate'
import {
  deletePage, discardDraft, DOCUMENT_TAG, getEditorState, isDocumentKey, publishDraft, restoreVersion, saveDraft, unpublishPage,
} from '@/lib/db/repositories/site-documents'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { GLOBAL_KEY, isPageKey, normalizeDocument, sectionTypes } from '@/lib/site-builder/document'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ key: string }> }

/** Estado do editor: rascunho, o que está publicado e o histórico. */
export async function GET(request: Request, { params }: Context) {
  const { key } = await params
  if (!isDocumentKey(key)) return fail('Página desconhecida.', 404)
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  return ok(await getEditorState(key))
}

/** Salva o rascunho (não muda o site). */
export async function PUT(request: Request, { params }: Context) {
  const { key } = await params
  if (!isDocumentKey(key)) return fail('Página desconhecida.', 404)
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const body = await jsonBody<{ document?: unknown }>(request)
  const result = normalizeDocument(body?.document, { allowEmpty: key === GLOBAL_KEY })
  if ('errors' in result) return fail('Revise os campos destacados.', 422, result.errors)
  if (key === GLOBAL_KEY && !result.value.design) return fail('Documento de aparência sem tema.', 422)
  // Páginas criadas no painel só levam blocos livres: as seções do site (vitrine, guias...) são da home.
  if (isPageKey(key) && result.value.sections.some((section) => sectionTypes[section.type].builtin)) return fail('Esta página só aceita blocos livres.', 422, { sections: 'Esta página só aceita blocos livres.' })
  await saveDraft(key, result.value, userId)
  return ok(await getEditorState(key))
}

/**
 * Ações sobre o rascunho: `publish` (vai ao ar), `discard` (volta ao publicado), `restore` (traz uma versão
 * antiga para o rascunho) e, só para páginas criadas no painel, `unpublish` (tira do ar, mantém o rascunho).
 * Cada uma entra na auditoria.
 */
export async function POST(request: Request, { params }: Context) {
  const { key } = await params
  if (!isDocumentKey(key)) return fail('Página desconhecida.', 404)
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const body = await jsonBody<{ action?: string; versionId?: string }>(request)

  if (body?.action === 'publish') {
    const published = await publishDraft(key, userId)
    invalidate(DOCUMENT_TAG, 'settings', 'catalog')
    await recordAudit({ actorUserId: userId, action: 'site.publish', entityType: 'página', entityId: key, after: { sections: published.sections.length } })
  } else if (body?.action === 'discard') {
    await discardDraft(key, userId)
    await recordAudit({ actorUserId: userId, action: 'site.discard', entityType: 'página', entityId: key })
  } else if (body?.action === 'restore' && typeof body.versionId === 'string') {
    const restored = await restoreVersion(key, body.versionId, userId)
    if (!restored) return fail('Versão não encontrada.', 404)
    await recordAudit({ actorUserId: userId, action: 'site.restore', entityType: 'página', entityId: key, after: { versionId: body.versionId } })
  } else if (body?.action === 'unpublish' && isPageKey(key)) {
    if (!await unpublishPage(key, userId)) return fail('Página não encontrada.', 404)
    invalidate(DOCUMENT_TAG, 'settings')
    await recordAudit({ actorUserId: userId, action: 'site.unpublish', entityType: 'página', entityId: key })
  } else {
    return fail('Ação inválida.', 422)
  }
  return ok(await getEditorState(key))
}

/** Apaga uma página criada no painel que não está no ar. A home e a aparência não podem ser apagadas. */
export async function DELETE(request: Request, { params }: Context) {
  const { key } = await params
  if (!isPageKey(key)) return fail('Só páginas criadas no painel podem ser apagadas.', 422)
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  if (!await deletePage(key)) return fail('A página está no ar ou não existe. Tire-a do ar antes de apagar.', 409)
  invalidate(DOCUMENT_TAG)
  await recordAudit({ actorUserId: userId, action: 'site.delete', entityType: 'página', entityId: key })
  return ok({ key })
}
