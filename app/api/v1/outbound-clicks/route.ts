import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { offers } from '@/lib/db/schema'
import { createSafeSubId, getAttribution, recordAffiliateClick } from '@/lib/analytics/attribution'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSetting } from '@/lib/settings'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// O relatório traz cliques e conversões brutos: só quem pode ler analytics.
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read')
  if (blocked) return blocked
  return ok(await getAttribution())
}

/**
 * Registra um clique em botão de compra. Guarda só a oferta, o ponto da página e um identificador de
 * visita gerado na aba; não grava IP, user agent nem usuário.
 */
export async function POST(request: Request) {
  const quota = rateLimit(request, 'outbound-click', 60)
  if (!quota.allowed) return fail('Limite de cliques excedido.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const body = await jsonBody<{ offerId?: string; slot?: string; campaign?: string; experiment?: string; sessionId?: string }>(request)
  if (!body?.offerId || !uuid.test(body.offerId)) return fail('Oferta inválida.', 422)
  if (((await getSetting('tracking')).disabledEvents as string[]).includes('affiliate_click')) return ok({ clickId: null, recorded: false })
  const [offer] = await db.select({ id: offers.id }).from(offers).where(eq(offers.id, body.offerId))
  if (!offer) return fail('Oferta não encontrada.', 404)
  const subId = createSafeSubId([body.campaign ?? 'organic', body.slot ?? 'unknown', body.experiment ?? 'control'])
  const sessionId = body.sessionId && body.sessionId.length <= 64 ? body.sessionId : crypto.randomUUID()
  const click = await recordAffiliateClick({ offerId: body.offerId, subId, slot: body.slot?.slice(0, 40), sessionId })
  return ok({ clickId: click.clickId }, { status: 201 })
}
