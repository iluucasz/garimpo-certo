import { auth } from '@/lib/auth/auth'
import { MFA_ROLES, mfaEnforced, needsMfa } from '@/lib/auth/mfa'
import { getUserRoles } from '@/lib/auth/permissions'
import { fail, ok } from '@/lib/server/api'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Sessão inválida ou ausente.', 401)
  const roles = await getUserRoles(session.user.id)
  const enabled = Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled)
  return ok({
    user: session.user,
    roles,
    // `required`: o papel pede MFA; `enforced`: o painel já bloqueia quem não ativou.
    mfa: { enabled, required: needsMfa(roles.map((role) => role.code)), enforced: mfaEnforced(), roles: MFA_ROLES },
  })
}
