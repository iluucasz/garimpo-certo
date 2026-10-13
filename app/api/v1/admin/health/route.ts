import { getOpsHealth } from '@/lib/ops/health'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Alertas operacionais com detalhe (importação, comissões, tarefas e prazos da LGPD). Só para a equipe. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  return ok(await getOpsHealth())
}
