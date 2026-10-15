import { recordAudit } from '@/lib/admin/audit'
import { loadCandidates } from '@/lib/social/store'
import { channelLabel, isContentChannel } from '@/lib/social/content'
import { contentToday, createContentPost, listContent, loadContentSettings, planContentToday } from '@/lib/social/content-store'
import { contentView } from '@/lib/social/content-view'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Fila de conteúdo dos últimos dias, o resumo de hoje por rede e os ajustes. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const settings = await loadContentSettings()
  const [rows, today] = await Promise.all([listContent(14), contentToday(settings)])
  return ok({ settings, today, items: rows.map(contentView) })
}

/** `plan`: completa os posts de hoje; `create`: cria o conteúdo de um produto (`productId`) para uma rede (`channel`). */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'catalog:write')
  if (blocked) return blocked
  const body = await jsonBody<{ action?: string; productId?: string; channel?: string }>(request)
  const settings = await loadContentSettings()

  if (body?.action === 'plan') {
    const plan = await planContentToday(settings, Date.now(), userId)
    const total = plan.created.reduce((sum, item) => sum + item.count, 0)
    await recordAudit({ actorUserId: userId, action: 'content.plan', entityType: 'conteúdo', entityId: 'instagram-tiktok', after: { created: plan.created } })
    return ok({ created: total, byChannel: plan.created, notes: plan.notes })
  }

  if (body?.action === 'create' && typeof body.productId === 'string' && isContentChannel(body.channel)) {
    const candidate = (await loadCandidates(body.channel)).find((item) => item.productId === body.productId)
    if (!candidate) return fail('Produto não encontrado ou sem oferta ativa.', 404)
    try {
      const row = await createContentPost({ candidate, channel: body.channel, settings, source: 'manual', scheduledFor: null, userId })
      await recordAudit({ actorUserId: userId, action: 'content.create', entityType: 'conteúdo', entityId: row.id, after: { channel: body.channel, productId: candidate.productId } })
      return ok(contentView(row), { status: 201 })
    } catch (error) {
      console.error('[content] não foi possível criar', channel(body.channel), error instanceof Error ? error.message : error)
      return fail('Não foi possível gerar o link de afiliado agora. Tente de novo em instantes.', 502)
    }
  }
  return fail('Ação inválida.', 422)
}

const channel = (value: string) => isContentChannel(value) ? channelLabel[value] : value
