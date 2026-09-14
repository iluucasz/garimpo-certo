import { listEvents } from '@/lib/db/repositories/events'
import { authorize, ok } from '@/lib/server/api'
import { mockCache } from '@/lib/server/mock-cache'
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read'); if (blocked) return blocked
  const cacheKey = 'rollups:overview'
  const cached = mockCache.get<Record<string, unknown>>(cacheKey)
  if (cached) return ok({ ...cached, cache: 'hit' })
  const events = await listEvents()
  const counts = events.reduce<Record<string, number>>((acc, event) => { acc[event.eventName] = (acc[event.eventName] ?? 0) + 1; return acc }, {})
  const clicks = counts.AffiliateClicked ?? 0
  const conversions = counts.ConversionReceived ?? 0
  const result = { period: '24h', events: events.length, byType: counts, conversionRate: clicks ? Number((conversions / clicks * 100).toFixed(2)) : 0, generatedAt: new Date().toISOString() }
  mockCache.set(cacheKey, result, 30)
  return ok({ ...result, cache: 'miss' })
}
