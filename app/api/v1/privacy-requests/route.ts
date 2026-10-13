import { and, gt, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/client'
import { privacyRequests } from '@/lib/db/schema'
import { validatePrivacyRequest } from '@/lib/privacy/requests'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

/** Teto de pedidos por hora no sistema inteiro: o formulário é público e o limite por IP não cobre várias instâncias. */
const HOURLY_CAP = 100

/**
 * Pedido de titular de dados feito por quem não tem conta (ou não quer entrar). Cai na fila do painel (LGPD).
 * Não responde se o e-mail já tem conta: devolve só um protocolo.
 */
export async function POST(request: Request) {
  const quota = rateLimit(request, 'privacy-request', 5, 10 * 60_000)
  if (!quota.allowed) return fail('Muitos pedidos seguidos. Tente de novo em alguns minutos.', 429, undefined, { 'retry-after': String(quota.retryAfter) })

  const body = await jsonBody<Record<string, unknown>>(request)
  if (!body) return fail('Pedido inválido.', 400)
  // Campo-armadilha: pessoas não o veem; robôs costumam preencher tudo.
  if (typeof body.website === 'string' && body.website.trim()) return ok({ protocol: 'RECEBIDO' }, { status: 201 })

  const result = validatePrivacyRequest(body)
  if ('errors' in result) return fail('Revise os campos destacados.', 422, result.errors)

  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(privacyRequests)
    .where(and(gt(privacyRequests.requestedAt, sql`now() - interval '1 hour'`)))
  if ((recent?.n ?? 0) >= HOURLY_CAP) return fail('Estamos com muitos pedidos agora. Tente de novo mais tarde.', 429)

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  const [created] = await db.insert(privacyRequests).values({
    userId: session?.user.id ?? null,
    email: result.value.email,
    type: result.value.type,
    message: result.value.message,
    source: 'portal',
  }).returning({ id: privacyRequests.id })

  return ok({ protocol: created.id.slice(0, 8).toUpperCase() }, { status: 201 })
}
