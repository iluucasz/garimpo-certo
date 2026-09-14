import { withIdempotency } from '@/lib/db/idempotency'
import { enqueueJob } from '@/lib/db/repositories/jobs'
import { recordProviderProductMapping } from '@/lib/db/repositories/matching'
import { getProviderByCode } from '@/lib/db/repositories/providers'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { normalizeProviderProduct, type RawProviderProduct } from '@/lib/server/ingestion'

type Context = { params: Promise<{ provider: string }> }
export async function POST(request: Request, context: Context) {
  const { blocked } = await authorize(request, 'jobs:run'); if (blocked) return blocked
  const key = request.headers.get('idempotency-key'); if (!key) return fail('Idempotency-Key é obrigatório.', 428)
  const { provider } = await context.params
  const body = await jsonBody<{ items?: RawProviderProduct[] }>(request)
  const result = await withIdempotency(key, async () => {
    const providerRow = await getProviderByCode(provider)
    const items = await Promise.all((body?.items ?? []).map(async (item) => {
      const normalized = await normalizeProviderProduct(item, provider)
      if (providerRow) await recordProviderProductMapping({ providerId: providerRow.id, externalProductId: normalized.externalId, candidates: normalized.candidates })
      return normalized
    }))
    const job = await enqueueJob('provider.import', { provider, count: items.length })
    return { job, items, provider }
  })
  return ok({ ...result.value, idempotency: { key, replayed: result.replayed } }, { status: result.replayed ? 200 : 202 })
}
