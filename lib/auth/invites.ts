import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminInvites, roles, userRoles, users } from '@/lib/db/schema'
import type { AdminRole } from './rbac'

/** Validade do convite. Depois disso é preciso gerar outro. */
export const INVITE_TTL_DAYS = 7

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
export const normalizeEmail = (email: string) => email.trim().toLowerCase()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const isEmail = (value: string) => value.length <= 254 && emailPattern.test(value)

export function statusOf(invite: { acceptedAt: string | null; revokedAt: string | null; expiresAt: string }, now = Date.now()): InviteStatus {
  if (invite.acceptedAt) return 'accepted'
  if (invite.revokedAt) return 'revoked'
  return new Date(invite.expiresAt).getTime() <= now ? 'expired' : 'pending'
}

/** `ana.silva@gmail.com` → `a•••@gmail.com`: a página pública do convite não entrega o e-mail inteiro. */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}•••@${domain ?? ''}`
}

/** Só OWNER convida OWNER ou ADMIN; os demais papéis, qualquer um com `users:manage`. */
export function canInvite(actorRoles: AdminRole[], target: AdminRole) {
  if (target === 'OWNER' || target === 'ADMIN') return actorRoles.includes('OWNER')
  return actorRoles.includes('OWNER') || actorRoles.includes('ADMIN')
}

export async function createInvite(input: { email: string; roleCode: AdminRole; invitedBy: string }) {
  const [role] = await db.select({ id: roles.id, code: roles.code }).from(roles).where(eq(roles.code, input.roleCode))
  if (!role) return null
  const email = normalizeEmail(input.email)
  // Um convite pendente por e-mail: o novo substitui o anterior.
  await db.update(adminInvites).set({ revokedAt: new Date().toISOString() })
    .where(and(eq(adminInvites.email, email), isNull(adminInvites.acceptedAt), isNull(adminInvites.revokedAt)))
  const token = newToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()
  const [created] = await db.insert(adminInvites).values({ email, roleId: role.id, tokenHash: hashToken(token), invitedBy: input.invitedBy, expiresAt })
    .returning({ id: adminInvites.id })
  return { id: created.id, token, email, roleCode: role.code as AdminRole, expiresAt }
}

export async function findInviteByToken(token: string) {
  if (!token || token.length > 128) return null
  const [row] = await db.select({
    id: adminInvites.id, email: adminInvites.email, roleId: adminInvites.roleId, roleCode: roles.code,
    expiresAt: adminInvites.expiresAt, acceptedAt: adminInvites.acceptedAt, revokedAt: adminInvites.revokedAt,
  }).from(adminInvites).innerJoin(roles, eq(roles.id, adminInvites.roleId)).where(eq(adminInvites.tokenHash, hashToken(token)))
  return row ? { ...row, status: statusOf(row) } : null
}

export type AcceptResult =
  | { ok: true; roleCode: AdminRole }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'accepted' | 'email_mismatch'; message: string }

/** Concede o papel do convite à conta logada, desde que o e-mail da conta seja o do convite. */
export async function acceptInvite(token: string, user: { id: string; email: string }): Promise<AcceptResult> {
  const invite = await findInviteByToken(token)
  if (!invite) return { ok: false, reason: 'not_found', message: 'Convite não encontrado.' }
  if (invite.status === 'accepted') return { ok: false, reason: 'accepted', message: 'Este convite já foi usado.' }
  if (invite.status === 'revoked') return { ok: false, reason: 'revoked', message: 'Este convite foi cancelado. Peça um novo.' }
  if (invite.status === 'expired') return { ok: false, reason: 'expired', message: 'Este convite venceu. Peça um novo.' }
  if (normalizeEmail(user.email) !== invite.email) {
    return { ok: false, reason: 'email_mismatch', message: `Este convite é para ${maskEmail(invite.email)}. Entre com essa conta para aceitar.` }
  }
  const accepted = await db.transaction(async (tx) => {
    // `accepted_at is null` na condição: dois cliques simultâneos não aceitam duas vezes.
    const claimed = await tx.update(adminInvites).set({ acceptedAt: new Date().toISOString(), acceptedUserId: user.id })
      .where(and(eq(adminInvites.id, invite.id), isNull(adminInvites.acceptedAt), isNull(adminInvites.revokedAt)))
      .returning({ id: adminInvites.id })
    if (!claimed.length) return false
    await tx.insert(userRoles).values({ userId: user.id, roleId: invite.roleId }).onConflictDoNothing()
    return true
  })
  if (!accepted) return { ok: false, reason: 'accepted', message: 'Este convite já foi usado.' }
  return { ok: true, roleCode: invite.roleCode as AdminRole }
}

export async function listInvites(limit = 50) {
  const rows = await db.select({
    id: adminInvites.id, email: adminInvites.email, roleCode: roles.code, createdAt: adminInvites.createdAt, expiresAt: adminInvites.expiresAt,
    acceptedAt: adminInvites.acceptedAt, revokedAt: adminInvites.revokedAt,
    invitedBy: sql<string | null>`(select u.email from users u where u.id = ${adminInvites.invitedBy})`,
  }).from(adminInvites).innerJoin(roles, eq(roles.id, adminInvites.roleId)).orderBy(desc(adminInvites.createdAt)).limit(limit)
  return rows.map((row) => ({ ...row, status: statusOf(row) }))
}

export async function revokeInvite(id: string) {
  const [row] = await db.update(adminInvites).set({ revokedAt: new Date().toISOString() })
    .where(and(eq(adminInvites.id, id), isNull(adminInvites.acceptedAt), isNull(adminInvites.revokedAt)))
    .returning({ id: adminInvites.id, email: adminInvites.email })
  return row ?? null
}

/** Existe conta com esse e-mail? Só para o painel avisar "essa pessoa já tem conta". */
export async function accountExists(email: string) {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizeEmail(email)))
  return Boolean(row)
}
