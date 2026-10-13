import { recordAudit } from '@/lib/admin/audit'
import { invalidate } from '@/lib/db/invalidate'
import { discardDraft, DOCUMENT_TAG, getEditorState, isDocumentKey, publishDraft, restoreVersion, saveDraft } from '@/lib/db/repositories/site-documents'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { normalizeDocument } from '@/lib/site-builder/document'

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
  const result = normalizeDocument(body?.document)
  if ('errors' in result) return fail('Revise as seções destacadas.', 422, result.errors)
  await saveDraft(key, result.value, userId)
  return ok(await getEditorState(key))
}

/**
 * Ações sobre o rascunho: `publish` (vai ao ar), `discard` (volta ao publicado) e `restore` (traz uma versão
 * antiga para o rascunho). Cada uma entra na auditoria.
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
  } else {
    return fail('Ação inválida.', 422)
  }
  return ok(await getEditorState(key))
}
