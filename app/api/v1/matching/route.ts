import { getProviderByCode } from '@/lib/db/repositories/providers'
import { recordProviderProductMapping, resolveMatchStatus } from '@/lib/db/repositories/matching'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { matchProviderProduct, type RawProviderProduct } from '@/lib/server/ingestion'

export async function POST(request: Request) {
  const { blocked } = await authorize(request, 'catalog:write'); if (blocked) return blocked
  const body = await jsonBody<RawProviderProduct & { provider: string }>(request)
  if (!body?.externalId || !body.title || !body.url || !body.provider) return fail('externalId, title, url e provider são obrigatórios.', 422)
  const provider = await getProviderByCode(body.provider)
  if (!provider) return fail('Provider desconhecido.', 422)
  const candidates = await matchProviderProduct(body)
  const mapping = await recordProviderProductMapping({ providerId: provider.id, externalProductId: body.externalId, candidates })
  return ok({ source: body, candidates, requiresReview: resolveMatchStatus(candidates) === 'pending_review', mapping })
}
