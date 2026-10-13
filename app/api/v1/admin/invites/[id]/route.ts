import { recordAudit } from '@/lib/admin/audit'
import { revokeInvite } from '@/lib/auth/invites'
import { authorize, fail, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cancela um convite pendente. Convites já usados não voltam atrás (para tirar o acesso, edite os papéis do usuário). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { blocked, userId } = await authorize(request, 'users:manage')
  if (blocked) return blocked
  const { id } = await params
  if (!uuid.test(id)) return fail('Convite não encontrado.', 404)
  const revoked = await revokeInvite(id)
  if (!revoked) return fail('Convite não encontrado ou já encerrado.', 404)
  await recordAudit({ actorUserId: userId, action: 'invites.revoke', entityType: 'convite', entityId: id, before: { email: revoked.email } })
  return ok({ id })
}
