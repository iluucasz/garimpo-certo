import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { offers } from '@/lib/db/schema'
import { createSafeSubId, getAttribution, recordAffiliateClick } from '@/lib/analytics/attribution'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/mock-rate-limit'

export async function GET() { return ok(await getAttribution()) }
export async function POST(request: Request) {
  const quota = rateLimit(request, 'outbound-click', 60)
  if (!quota.allowed) return fail('Limite de cliques excedido.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const body = await jsonBody<{ offerId: string; slot?: string; campaign?: string; experiment?: string; sessionId: string }>(request)
  if (!body?.offerId || !body.sessionId) return fail('Oferta e sessão são obrigatórias.', 422)
  const [offer] = await db.select({ id: offers.id }).from(offers).where(eq(offers.id, body.offerId))
  if (!offer) return fail('Oferta não encontrada.', 404)
  const subId = createSafeSubId([body.campaign ?? 'organic', body.slot ?? 'unknown', body.experiment ?? 'control'])
  const click = await recordAffiliateClick({ offerId: body.offerId, subId, slot: body.slot, sessionId: body.sessionId })
  return ok({ ...click, redirectPolicy: 'provider_terms_required' }, { status: 201 })
}
