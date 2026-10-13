import { db } from '@/lib/db/client'
import { analyticsEvents } from '@/lib/db/schema'
import { getRunningExperiment } from '@/lib/db/repositories/experiments'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'
import { getSetting } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/**
 * Registra que uma visita viu uma variante do teste em andamento. O navegador só chama com a medição permitida.
 * Guarda o teste, a variante e o identificador da aba; nada que identifique a pessoa.
 */
export async function POST(request: Request) {
  const quota = rateLimit(request, 'experiment-exposure', 60)
  if (!quota.allowed) return fail('Limite excedido.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const body = await jsonBody<{ key?: string; variant?: string; sessionId?: string }>(request)
  if (!body?.key || (body.variant !== 'a' && body.variant !== 'b') || !body.sessionId || body.sessionId.length > 64) return fail('Pedido inválido.', 422)
  if (((await getSetting('tracking')).disabledEvents as string[]).includes('experiment_exposure')) return ok({ recorded: false })

  const running = await getRunningExperiment()
  if (!running || running.key !== body.key) return ok({ recorded: false })
  await db.insert(analyticsEvents).values({
    eventName: 'experiment_exposure', anonymousId: body.sessionId, sessionId: body.sessionId,
    metadata: { experiment: running.key, variant: body.variant },
  })
  return ok({ recorded: true }, { status: 201 })
}
