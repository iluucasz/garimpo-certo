import { getCouponClickReport } from '@/lib/db/repositories/coupon-clicks'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Cliques medidos nos cupons: totais, últimos 14 dias e os mais clicados. Mesma permissão da lista de cupons. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  return ok(await getCouponClickReport())
}
