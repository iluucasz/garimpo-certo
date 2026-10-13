import { recordAudit } from '@/lib/admin/audit'
import { runSocialQueue } from '@/lib/social/run'
import { createPost, listPosts, loadCandidates, loadSocialSettings, planToday, readSocialState } from '@/lib/social/store'
import { checkTelegram, telegramConfig, TelegramError } from '@/lib/social/telegram'
import { deepseekConfig } from '@/lib/ai/deepseek'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const view = (row: Awaited<ReturnType<typeof listPosts>>[number]) => ({
  id: row.id, status: row.status, text: row.text, imageUrl: row.imageUrl, linkUrl: row.linkUrl, campaign: row.campaign, source: row.source,
  facts: row.facts, scheduledFor: row.scheduledFor, sentAt: row.sentAt, error: row.error, attempts: row.attempts, createdAt: row.createdAt,
})

/** Fila de postagens, configuração e se o bot do Telegram está configurado (sem expor o token). */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const [settings, state, posts] = await Promise.all([loadSocialSettings(), readSocialState(), listPosts({ limit: 150 })])
  return ok({ settings, state, configured: Boolean(telegramConfig()), aiAvailable: Boolean(deepseekConfig()), posts: posts.map(view) })
}

/**
 * Ações da fila. `plan`: completa a cota de hoje; `create`: cria a postagem de uma oferta (`productId`);
 * `run`: roda o planejamento e o envio agora; `check`: confere o token e o acesso ao canal sem publicar nada.
 */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'catalog:write')
  if (blocked) return blocked
  const body = await jsonBody<{ action?: string; productId?: string }>(request)
  const settings = await loadSocialSettings()

  if (body?.action === 'check') {
    const config = telegramConfig()
    if (!config) return fail('Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no ambiente.', 409)
    try {
      return ok(await checkTelegram(config))
    } catch (error) {
      return fail(error instanceof TelegramError ? error.message : 'Não foi possível conferir o Telegram.', 502)
    }
  }

  if (body?.action === 'plan') {
    const result = await planToday(settings, Date.now(), userId)
    await recordAudit({ actorUserId: userId, action: 'posts.plan', entityType: 'postagens', entityId: 'telegram', after: { created: result.created } })
    return ok({ created: result.created, reason: result.reason })
  }

  if (body?.action === 'run') {
    const state = await runSocialQueue()
    return ok(state)
  }

  if (body?.action === 'create' && typeof body.productId === 'string') {
    const candidate = (await loadCandidates()).find((item) => item.productId === body.productId)
    if (!candidate) return fail('Produto não encontrado ou sem oferta ativa.', 404)
    try {
      const row = await createPost({ candidate, campaign: settings.campaign, source: 'manual', status: 'pending', scheduledFor: null, userId, useAi: settings.useAi })
      await recordAudit({ actorUserId: userId, action: 'posts.create', entityType: 'postagem', entityId: row.id, after: { productId: candidate.productId } })
      return ok(view(row), { status: 201 })
    } catch (error) {
      console.error('[posts] não foi possível criar', error instanceof Error ? error.message : error)
      return fail('Não foi possível gerar o link de afiliado agora. Tente de novo em instantes.', 502)
    }
  }
  return fail('Ação inválida.', 422)
}
