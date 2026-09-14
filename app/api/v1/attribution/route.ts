import { getAttribution, type ConversionStatus } from '@/lib/analytics/attribution'
import { authorize, ok } from '@/lib/server/api'

export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read'); if (blocked) return blocked
  const params = new URL(request.url).searchParams
  const report = await getAttribution({
    providerId: params.get('providerId') ?? undefined,
    slot: params.get('slot') ?? undefined,
    status: (params.get('status') as ConversionStatus | null) ?? undefined,
  })
  return ok(report)
}
