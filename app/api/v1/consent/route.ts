import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/client'
import { consentRecords } from '@/lib/db/schema'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const optional = ['analytics', 'personalization', 'marketing'] as const

/**
 * Guarda a escolha de privacidade como prova de consentimento (LGPD, art. 8º, §2º): o que foi aceito ou recusado,
 * por quem (identificador aleatório do navegador, e a conta quando há sessão) e quando. Só grava o que mudou.
 * Registrar a própria escolha não depende de a pessoa ter aceitado a medição.
 */
export async function POST(request: Request) {
  const quota = rateLimit(request, 'consent', 30)
  if (!quota.allowed) return fail('Limite excedido.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const body = await jsonBody<{ id?: string } & Partial<Record<(typeof optional)[number], unknown>>>(request)
  if (!body?.id || !uuid.test(body.id)) return fail('Identificador inválido.', 422)

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  const userId = session?.user.id ?? null
  const choices: { category: 'necessary' | (typeof optional)[number]; granted: boolean; basis: string }[] = [
    { category: 'necessary', granted: true, basis: 'legitimate_interest' },
    ...optional.map((category) => ({ category, granted: body[category] === true, basis: 'consent' })),
  ]

  let recorded = 0
  for (const choice of choices) {
    const [last] = await db.select({ granted: consentRecords.granted }).from(consentRecords)
      .where(and(eq(consentRecords.anonymousId, body.id), eq(consentRecords.category, choice.category)))
      .orderBy(desc(consentRecords.recordedAt)).limit(1)
    if (last && last.granted === String(choice.granted)) continue
    await db.insert(consentRecords).values({ anonymousId: body.id, userId, category: choice.category, granted: String(choice.granted), legalBasis: choice.basis })
    recorded++
  }
  return ok({ recorded }, { status: recorded ? 201 : 200 })
}
