import { recordAudit } from '@/lib/admin/audit'
import { CONTENT_LIMIT } from '@/lib/social/content'
import { cancelContent, loadContentSettings, markPublished, replaceContent, updateContent } from '@/lib/social/content-store'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { contentView } from '@/lib/social/content-view'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Edita e decide um conteúdo. Corpo: `{ text?, script?, action?: 'published' | 'cancel' | 'replace', url? }`.
 * `published` marca como publicado (a publicação é feita à mão na rede); `replace` troca o produto.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { blocked, userId } = await authorize(request, 'catalog:write')
  if (blocked) return blocked
  const { id } = await params
  if (!uuid.test(id)) return fail('Conteúdo não encontrado.', 404)
  const body = await jsonBody<{ text?: string; script?: string; action?: string; url?: string }>(request)
  if (!body) return fail('Pedido inválido.', 400)

  const patch: { text?: string; script?: string } = {}
  if (body.text !== undefined) {
    const text = String(body.text).trim()
    if (!text) return fail('A legenda não pode ficar vazia.', 422, { text: 'Escreva a legenda.' })
    if (text.length > CONTENT_LIMIT) return fail('Legenda grande demais.', 422, { text: `No máximo ${CONTENT_LIMIT} caracteres.` })
    patch.text = text
  }
  if (body.script !== undefined) {
    const script = String(body.script).trim()
    if (script.length > 4000) return fail('Roteiro grande demais.', 422, { script: 'No máximo 4.000 caracteres.' })
    patch.script = script
  }

  let row = Object.keys(patch).length ? await updateContent(id, patch) : null
  if (Object.keys(patch).length && !row) return fail('Só conteúdo ainda não publicado pode ser editado.', 409)

  if (body.action === 'published') {
    const url = typeof body.url === 'string' ? body.url.trim().slice(0, 500) : ''
    if (url && !/^https:\/\//i.test(url)) return fail('O endereço da publicação precisa começar com https://.', 422, { url: 'Use o endereço completo da publicação.' })
    const published = await markPublished(id, userId, url || null)
    if (!published) return fail('Este conteúdo já foi publicado ou cancelado.', 409)
    await recordAudit({ actorUserId: userId, action: 'content.published', entityType: 'conteúdo', entityId: id, after: { channel: published.channel } })
    return ok(contentView(published))
  }

  if (body.action === 'cancel') {
    const cancelled = await cancelContent(id)
    if (!cancelled) return fail('Este conteúdo já foi publicado ou cancelado.', 409)
    await recordAudit({ actorUserId: userId, action: 'content.cancel', entityType: 'conteúdo', entityId: id })
    return ok(contentView(cancelled))
  }

  if (body.action === 'replace') {
    const replaced = await replaceContent(id, await loadContentSettings(), userId)
    if (!replaced.ok) return fail(replaced.reason, 409)
    await recordAudit({ actorUserId: userId, action: 'content.replace', entityType: 'conteúdo', entityId: id, after: { newId: replaced.row.id } })
    return ok(contentView(replaced.row))
  }

  if (!row) return fail('Nada a fazer.', 422)
  return ok(contentView(row))
}
