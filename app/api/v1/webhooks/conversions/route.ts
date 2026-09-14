import { withIdempotency } from '@/lib/db/idempotency'
import { publishEvent } from '@/lib/db/repositories/events'
import { getProviderByCode } from '@/lib/db/repositories/providers'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/mock-rate-limit'
import { recordConversion, type ConversionStatus } from '@/lib/analytics/attribution'
import { isFreshWebhook } from '@/lib/security/controls'

const statuses: ConversionStatus[] = ['pending', 'approved', 'rejected', 'cancelled', 'paid']

export async function POST(request: Request) {
  const quota = rateLimit(request, 'conversion-webhook', 20)
  if (!quota.allowed) return fail('Limite de webhooks excedido.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const key = request.headers.get('idempotency-key'); if (!key) return fail('Idempotency-Key é obrigatório.', 428)
  const signature = request.headers.get('x-mock-signature'); if (signature !== 'garimpo-mock-signature') return fail('Assinatura inválida.', 401)
  if (!isFreshWebhook(request.headers.get('x-mock-timestamp'))) return fail('Webhook expirado.', 401)
  const body = await jsonBody<{ conversionId: string; clickId: string; amount: number; commission?: number; provider: string; orderReferenceHash?: string; status?: ConversionStatus }>(request)
  if (!body?.conversionId || !body.clickId || typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 || !body.provider ||
    (body.commission !== undefined && (!Number.isFinite(body.commission) || body.commission < 0)) || (body.status && !statuses.includes(body.status))) {
    return fail('Conversão inválida.', 422)
  }
  const provider = await getProviderByCode(body.provider)
  if (!provider) return fail('Provider desconhecido.', 422)
  const result = await withIdempotency(`conversion:${key}`, async () => {
    const conversion = await recordConversion({
      providerConversionId: body.conversionId, clickId: body.clickId, providerId: provider.id,
      orderReferenceHash: body.orderReferenceHash ?? `sha256_mock_${body.conversionId}`,
      amount: body.amount, commission: body.commission ?? body.amount * .04, status: body.status ?? 'pending',
    })
    await publishEvent('ConversionReceived', body.conversionId, conversion)
    return conversion
  })
  return ok({ ...result.value, replayed: result.replayed }, { status: result.replayed ? 200 : 202 })
}
