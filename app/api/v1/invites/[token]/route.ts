import { findInviteByToken, maskEmail } from '@/lib/auth/invites'
import { fail, ok } from '@/lib/server/api'
import { rateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

/** O que a página do convite mostra antes de entrar: e-mail mascarado, papel e situação. Não revela nada sem o token. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const quota = rateLimit(request, 'invite-lookup', 30)
  if (!quota.allowed) return fail('Muitas consultas. Tente de novo em instantes.', 429, undefined, { 'retry-after': String(quota.retryAfter) })
  const { token } = await params
  const invite = await findInviteByToken(token)
  if (!invite) return fail('Convite não encontrado.', 404)
  return ok({ email: maskEmail(invite.email), role: invite.roleCode, status: invite.status, expiresAt: invite.expiresAt })
}
