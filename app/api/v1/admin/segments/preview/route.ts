import { parseSegmentRules, segmentReach } from '@/lib/admin/resources'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Calcula o alcance de regras ainda não salvas, para o editor mostrar o número enquanto se monta o segmento. */
export async function POST(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read')
  if (blocked) return blocked
  const body = await jsonBody<{ match?: string; rules?: unknown }>(request)
  if (!body) return fail('Corpo da requisição inválido.', 400)
  const rules = parseSegmentRules(body.rules)
  const reach = await segmentReach(body.match === 'any' ? 'any' : 'all', rules)
  return ok({ reach, windowDays: rules.windowDays, conditions: rules.conditions.length })
}
