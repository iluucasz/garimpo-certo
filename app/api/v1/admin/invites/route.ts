import { recordAudit } from '@/lib/admin/audit'
import { buildInviteEmail, emailEnabled, sendEmail } from '@/lib/auth/email'
import { accountExists, canInvite, createInvite, INVITE_TTL_DAYS, isEmail, listInvites, normalizeEmail } from '@/lib/auth/invites'
import { getUserRoles } from '@/lib/auth/permissions'
import { adminRoles, type AdminRole } from '@/lib/auth/rbac'
import { siteUrl } from '@/lib/site'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

/** Convites da equipe (pendentes, usados, vencidos e cancelados). */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'users:manage')
  if (blocked) return blocked
  return ok({ invites: await listInvites(), ttlDays: INVITE_TTL_DAYS, emailEnabled: emailEnabled() })
}

/**
 * Cria um convite e devolve o link (aparece uma única vez). Se o envio de e-mail estiver ativo, também envia.
 * Só proprietários convidam proprietários e administradores.
 */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'users:manage')
  if (blocked) return blocked
  const body = await jsonBody<{ email?: string; role?: string }>(request)
  const email = normalizeEmail(body?.email ?? '')
  const role = body?.role as AdminRole | undefined
  const errors: Record<string, string> = {}
  if (!isEmail(email)) errors.email = 'Informe um e-mail válido.'
  if (!role || !adminRoles.includes(role)) errors.role = 'Escolha o papel.'
  if (Object.keys(errors).length) return fail('Revise os campos destacados.', 422, errors)

  const actorRoles = (await getUserRoles(userId)).map((item) => item.code)
  if (!canInvite(actorRoles, role!)) return fail('Só um proprietário pode convidar proprietários e administradores.', 403)

  const invite = await createInvite({ email, roleCode: role!, invitedBy: userId })
  if (!invite) return fail('Papel não encontrado. Rode o seed de papéis.', 409)

  const link = `${siteUrl}/convite/${invite.token}`
  let emailed = false
  if (emailEnabled()) emailed = await sendEmail({ to: invite.email, ...buildInviteEmail({ url: link, role: invite.roleCode, days: INVITE_TTL_DAYS }) })
  await recordAudit({ actorUserId: userId, action: 'invites.create', entityType: 'convite', entityId: invite.id, after: { email: invite.email, role: invite.roleCode, emailed } })

  return ok({ id: invite.id, email: invite.email, role: invite.roleCode, expiresAt: invite.expiresAt, link, emailed, hasAccount: await accountExists(invite.email) }, { status: 201 })
}
