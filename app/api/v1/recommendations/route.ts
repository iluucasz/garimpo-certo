import { fail, ok } from '@/lib/server/api'
import { mockCache } from '@/lib/server/mock-cache'
import { generateRecommendations } from '@/lib/recommendation/engine'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'

function parseInterests(value: string | null) {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number'))
  } catch { return null }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const interests = parseInterests(params.get('interests'))
  if (interests === null) return fail('O parâmetro interests deve ser um objeto JSON válido.', 422)
  const limit = Number(params.get('limit') ?? 6)
  const explorationRate = Number(params.get('explorationRate') ?? .12)
  if (!Number.isFinite(limit) || !Number.isFinite(explorationRate)) return fail('Parâmetros numéricos inválidos.', 422)
  const input = {
    slot: params.get('slot') ?? 'home_for_you', seed: params.get('seed') ?? 'anonymous',
    category: params.get('category') ?? undefined, productId: params.get('productId') ?? undefined,
    exclude: (params.get('exclude') ?? '').split(',').filter(Boolean), limit, explorationRate, interests,
    favoriteIds: (params.get('favorites') ?? '').split(',').filter(Boolean), historyIds: (params.get('history') ?? '').split(',').filter(Boolean),
  }
  const cacheKey = `recommendation:${JSON.stringify(input)}`
  const cached = mockCache.get<ReturnType<typeof generateRecommendations>>(cacheKey)
  if (cached) return ok({ ...cached, cache: 'HIT' })
  const { products, offers } = await getStoreCatalog()
  const snapshot = generateRecommendations(input, { products, offers })
  mockCache.set(cacheKey, snapshot, 900)
  return ok({ ...snapshot, cache: 'MISS' })
}
