import { eq } from 'drizzle-orm'
import { recordAudit } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { socialPosts } from '@/lib/db/schema'
import { MESSAGE_LIMIT } from '@/lib/social/compose'
import { approvePost, cancelPost, deliverPost, updatePost } from '@/lib/social/store'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isoOrNull = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined
}

/**
 * Edita e decide uma postagem. Corpo: `{ text?, scheduledFor?, action?: 'approve' | 'cancel' | 'send' }`.
 * `send` aprova e envia na hora (precisa do bot configurado).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { blocked, userId } = await authorize(request, 'catalog:write')
  if (blocked) return blocked
  const { id } = await params
  if (!uuid.test(id)) return fail('Postagem não encontrada.', 404)
  const body = await jsonBody<{ text?: string; scheduledFor?: string | null; action?: string }>(request)
  if (!body) return fail('Pedido inválido.', 400)

  const patch: { text?: string; scheduledFor?: string | null } = {}
  if (body.text !== undefined) {
    const text = String(body.text).trim()
    if (!text) return fail('O texto não pode ficar vazio.', 422, { text: 'Escreva o texto da postagem.' })
    if (text.length > MESSAGE_LIMIT) return fail('Texto grande demais.', 422, { text: `No máximo ${MESSAGE_LIMIT} caracteres.` })
    patch.text = text
  }
  if (body.scheduledFor !== undefined) {
    const parsed = isoOrNull(body.scheduledFor)
    if (parsed === undefined) return fail('Horário inválido.', 422, { scheduledFor: 'Use uma data e hora válidas.' })
    patch.scheduledFor = parsed
  }

  let row = Object.keys(patch).length ? await updatePost(id, patch) : null
  if (Object.keys(patch).length && !row) return fail('Só postagens pendentes ou agendadas podem ser editadas.', 409)

  if (body.action === 'approve' || body.action === 'send') {
    row = await approvePost(id, userId, patch.scheduledFor) ?? (await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1))[0] ?? null
    if (!row || row.status !== 'approved') return fail('Esta postagem não está aguardando aprovação.', 409)
    if (body.action === 'send') {
      const now = new Date().toISOString()
      await db.update(socialPosts).set({ scheduledFor: now, updatedAt: now }).where(eq(socialPosts.id, id))
      const result = await deliverPost({ ...row, scheduledFor: now })
      await recordAudit({ actorUserId: userId, action: 'posts.send', entityType: 'postagem', entityId: id, after: { ok: result.ok } })
      if (!result.ok) return fail(result.error, 502)
      return ok({ id, status: 'sent', messageId: result.messageId })
    }
    await recordAudit({ actorUserId: userId, action: 'posts.approve', entityType: 'postagem', entityId: id })
    return ok({ id, status: row.status, scheduledFor: row.scheduledFor })
  }

  if (body.action === 'cancel') {
    const cancelled = await cancelPost(id)
    if (!cancelled) return fail('Esta postagem já foi enviada ou cancelada.', 409)
    await recordAudit({ actorUserId: userId, action: 'posts.cancel', entityType: 'postagem', entityId: id })
    return ok({ id, status: 'cancelled' })
  }

  if (!row) return fail('Nada a fazer.', 422)
  return ok({ id, status: row.status, scheduledFor: row.scheduledFor })
}
