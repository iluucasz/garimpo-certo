import { getWeeklyDigest } from '@/lib/engine/digest'
import { authorize, fail, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Resumo da semana da Engine (7 dias contra os 7 anteriores). Só leitura. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  try {
    return ok(await getWeeklyDigest())
  } catch (error) {
    console.error('[engine] falha ao montar o resumo da semana', error)
    return fail('Não foi possível montar o resumo da semana.', 500)
  }
}
