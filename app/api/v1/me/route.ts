import { auth } from '@/lib/auth/auth'
import { getUserRoles } from '@/lib/auth/permissions'
import { fail, ok } from '@/lib/server/api'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Sessão inválida ou ausente.', 401)
  const roles = await getUserRoles(session.user.id)
  return ok({ user: session.user, roles })
}
