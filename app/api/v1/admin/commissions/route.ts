import { getCommissionReport } from '@/lib/db/repositories/commissions'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Comissões reais da Shopee por situação, origem e produto. `?days=30` (1 a 365). */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read')
  if (blocked) return blocked
  const days = Number(new URL(request.url).searchParams.get('days') ?? 30)
  return ok(await getCommissionReport(Number.isFinite(days) ? days : 30))
}
