import { NextResponse } from 'next/server'
import { getOpsHealth } from '@/lib/ops/health'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Estado resumido para um monitor externo (UptimeRobot, Better Stack, cron de verificação).
 * Responde 200 com `ok` ou `warning` e **503** com `critical`, então basta o monitor alertar em 5xx.
 * Não devolve detalhes: quais rotinas falharam só aparece no painel (`/api/v1/admin/health`).
 */
export async function GET(request: Request) {
  const quota = rateLimit(request, 'health', 60)
  if (!quota.allowed) return NextResponse.json({ status: 'rate_limited' }, { status: 429, headers: { 'retry-after': String(quota.retryAfter) } })
  const health = await getOpsHealth()
  return NextResponse.json({ status: health.status, checkedAt: health.checkedAt }, { status: health.status === 'critical' ? 503 : 200, headers: { 'cache-control': 'no-store' } })
}
