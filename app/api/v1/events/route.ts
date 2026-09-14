import { withIdempotency } from '@/lib/db/idempotency'
import { listEvents, publishEvent, type DomainEventType } from '@/lib/db/repositories/events'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/mock-rate-limit'
export async function GET(request: Request) { const { blocked } = await authorize(request, 'analytics:read'); if (blocked) return blocked; return ok(await listEvents()) }
export async function POST(request: Request) {
  const quota = rateLimit(request, 'events', 60)
  if (!quota.allowed) return fail('Limite de eventos excedido.', 429, { remaining: 0 }, { 'retry-after': String(quota.retryAfter) })
  const body = await jsonBody<{ type: DomainEventType; aggregateId: string; payload?: Record<string, unknown> }>(request)
  if (!body?.type || !body.aggregateId) return fail('type e aggregateId são obrigatórios.', 422)
  const allowedTypes: DomainEventType[] = ['ProductCreated', 'ProductUpdated', 'OfferUpdated', 'PriceChanged', 'AffiliateClicked', 'ConversionReceived', 'FavoriteAdded']
  if (!allowedTypes.includes(body.type)) return fail('Tipo de evento não reconhecido.', 422)
  const key = request.headers.get('idempotency-key')
  const publish = () => publishEvent(body.type, body.aggregateId, body.payload ?? {})
  const result = key ? await withIdempotency(`event:${key}`, publish) : { replayed: false, value: await publish() }
  return ok({ ...result.value, replayed: result.replayed }, { status: result.replayed ? 200 : 202 })
}
