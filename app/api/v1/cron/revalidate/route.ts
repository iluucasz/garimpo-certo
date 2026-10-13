import { invalidate } from '@/lib/db/invalidate'
import { fail, ok } from '@/lib/server/api'
import { cronAuthorization } from '@/lib/server/cron-auth'

export const dynamic = 'force-dynamic'

/**
 * Faz o site enxergar um catálogo que foi atualizado por fora (o worker da VPS grava direto no banco).
 * Só invalida o cache; não importa nada. Mesmo segredo do cron: `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  const auth = cronAuthorization(request)
  if (auth === 'missing') return fail('CRON_SECRET não configurado.', 503)
  if (auth === 'denied') return fail('Não autorizado.', 401)
  invalidate('catalog', 'metrics')
  return ok({ revalidated: ['catalog', 'metrics'] })
}
