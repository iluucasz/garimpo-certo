import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { analyticsEvents, campaigns, coupons } from '@/lib/db/schema'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSetting } from '@/lib/settings'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Registra cliques em cupons e campanhas. Como em /outbound-clicks: só o item, o tipo e o identificador da aba;
 * sem IP, user agent ou usuário. O navegador só chama com a medição permitida.
 */
export async function POST(request: Request) {
  const quota = rateLimit(request, 'engagement', 60)
  if (!quota.allowed) return fail('Limite excedido.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const body = await jsonBody<{ kind?: string; id?: string; sessionId?: string }>(request)
  if (!body?.id || (body.kind !== 'coupon' && body.kind !== 'campaign')) return fail('Pedido inválido.', 422)
  const eventName = body.kind === 'coupon' ? 'coupon_click' : 'campaign_click'
  const tracking = await getSetting('tracking')
  if ((tracking.disabledEvents as string[]).includes(eventName)) return ok({ recorded: false })

  const sessionId = body.sessionId && body.sessionId.length <= 64 ? body.sessionId : crypto.randomUUID()
  if (body.kind === 'coupon') {
    if (!uuid.test(body.id)) return fail('Cupom inválido.', 422)
    const [coupon] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.id, body.id))
    if (!coupon) return fail('Cupom não encontrado.', 404)
    await db.insert(analyticsEvents).values({ eventName, anonymousId: sessionId, sessionId, metadata: { couponId: coupon.id } })
  } else {
    const [campaign] = await db.select({ slug: campaigns.slug }).from(campaigns).where(and(eq(campaigns.slug, body.id)))
    if (!campaign) return fail('Campanha não encontrada.', 404)
    await db.insert(analyticsEvents).values({ eventName, anonymousId: sessionId, sessionId, campaignId: campaign.slug, metadata: {} })
  }
  return ok({ recorded: true }, { status: 201 })
}
