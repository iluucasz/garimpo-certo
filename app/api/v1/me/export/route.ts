import { auth } from '@/lib/auth/auth'
import { getAccountExport } from '@/lib/db/repositories/account-data'
import { fail, ok } from '@/lib/server/api'

/** Acesso e portabilidade (LGPD): devolve os dados da própria conta. Exige sessão; não aceita outro id. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Sessão inválida ou ausente.', 401)
  const data = await getAccountExport(session.user.id)
  return ok(data, { headers: { 'cache-control': 'no-store' } })
}
