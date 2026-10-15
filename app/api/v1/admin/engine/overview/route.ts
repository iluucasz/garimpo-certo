import { getEngineOverview } from '@/lib/engine/overview'
import { authorize, fail, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Central da Engine: o que ela faz, quando rodou, o que espera aprovação e o que aprendeu. Só leitura. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  try {
    return ok(await getEngineOverview())
  } catch (error) {
    console.error('[engine] falha ao montar a central', error)
    return fail('Não foi possível carregar a central da Engine.', 500)
  }
}
