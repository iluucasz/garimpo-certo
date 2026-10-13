import { recordAudit } from '@/lib/admin/audit'
import { auth } from '@/lib/auth/auth'
import { acceptInvite } from '@/lib/auth/invites'
import { fail, jsonBody, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

const statusFor = { not_found: 404, expired: 410, revoked: 410, accepted: 409, email_mismatch: 403 } as const

/** Aceita o convite com a conta logada. O e-mail da conta precisa ser o do convite. */
export async function POST(request: Request) {
  const quota = rateLimit(request, 'invite-accept', 10)
  if (!quota.allowed) return fail('Muitas tentativas. Tente de novo em instantes.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Entre na sua conta para aceitar o convite.', 401)
  const body = await jsonBody<{ token?: string }>(request)
  if (!body?.token || typeof body.token !== 'string') return fail('Convite inválido.', 422)

  const result = await acceptInvite(body.token, { id: session.user.id, email: session.user.email })
  if (!result.ok) return fail(result.message, statusFor[result.reason])
  await recordAudit({ actorUserId: session.user.id, action: 'invites.accept', entityType: 'convite', entityId: session.user.id, after: { role: result.roleCode } })
  return ok({ role: result.roleCode })
}
