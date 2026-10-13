import { afterAll, describe, expect, it } from 'vitest'
import { eq, inArray, like } from 'drizzle-orm'
import { GET as listInvitesRoute, POST as createInviteRoute } from '@/app/api/v1/admin/invites/route'
import { DELETE as revokeInviteRoute } from '@/app/api/v1/admin/invites/[id]/route'
import { GET as lookupInvite } from '@/app/api/v1/invites/[token]/route'
import { POST as acceptInviteRoute } from '@/app/api/v1/invites/accept/route'
import { auth } from '@/lib/auth/auth'
import { canInvite, hashToken, maskEmail, statusOf } from '@/lib/auth/invites'
import { safeRedirect } from '@/lib/auth/redirect'
import { db } from '@/lib/db/client'
import { adminInvites, auditLogs, roles, userRoles, users } from '@/lib/db/schema'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { createAuthenticatedUser } from '../helpers/auth'

const createdUserIds: string[] = []
const inviteeEmail = () => `teste-convite-${crypto.randomUUID().slice(0, 8)}@example.com`

const asJson = (url: string, body: unknown, cookie?: string, method = 'POST') =>
  new Request(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
const plain = (url: string, cookie?: string, method = 'GET') => new Request(`http://localhost${url}`, { method, headers: cookie ? { cookie } : {} })

afterAll(async () => {
  await db.delete(adminInvites).where(like(adminInvites.email, 'teste-convite-%'))
  await db.delete(auditLogs).where(inArray(auditLogs.action, ['invites.create', 'invites.accept', 'invites.revoke']))
  if (createdUserIds.length) await db.delete(users).where(inArray(users.id, createdUserIds))
})

async function signUp(email: string) {
  const response = await auth.api.signUpEmail({ body: { email, password: 'senha-teste-123', name: 'Convidado' }, asResponse: true })
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  const userId = (await response.clone().json()).user.id as string
  createdUserIds.push(userId)
  return { cookie, userId }
}

async function invite(adminCookie: string, email: string, role: string) {
  const response = await createInviteRoute(asJson('/api/v1/admin/invites', { email, role }, adminCookie))
  return { status: response.status, body: await response.json() }
}

const tokenOf = (link: string) => link.split('/convite/')[1]

describe('regras puras do convite', () => {
  it('só proprietário convida proprietário e administrador', () => {
    expect(canInvite(['OWNER'], 'OWNER')).toBe(true)
    expect(canInvite(['ADMIN'], 'OWNER')).toBe(false)
    expect(canInvite(['ADMIN'], 'ADMIN')).toBe(false)
    expect(canInvite(['ADMIN'], 'MARKETING')).toBe(true)
    expect(canInvite(['MARKETING'], 'READ_ONLY')).toBe(false)
  })

  it('calcula a situação e mascara o e-mail', () => {
    const base = { acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 1000).toISOString() }
    expect(statusOf(base)).toBe('pending')
    expect(statusOf({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() })).toBe('expired')
    expect(statusOf({ ...base, revokedAt: new Date().toISOString() })).toBe('revoked')
    expect(statusOf({ ...base, acceptedAt: new Date().toISOString(), revokedAt: new Date().toISOString() })).toBe('accepted')
    expect(maskEmail('ana.silva@gmail.com')).toBe('a•••@gmail.com')
    expect(hashToken('abc')).toHaveLength(64)
  })

  it('só aceita destinos do próprio site depois do login', () => {
    expect(safeRedirect('/convite/abc')).toBe('/convite/abc')
    expect(safeRedirect('https://outro.site/x')).toBe('/conta')
    expect(safeRedirect('//outro.site')).toBe('/conta')
    expect(safeRedirect('/\\outro.site')).toBe('/conta')
    expect(safeRedirect(undefined)).toBe('/conta')
    expect(safeRedirect('', '/inicio')).toBe('/inicio')
  })
})

describe('convite de administradores', () => {
  it('exige sessão e a permissão users:manage', async () => {
    resetRateLimits()
    expect((await createInviteRoute(asJson('/api/v1/admin/invites', { email: inviteeEmail(), role: 'MARKETING' }))).status).toBe(401)
    const marketing = await createAuthenticatedUser('MARKETING')
    expect((await createInviteRoute(asJson('/api/v1/admin/invites', { email: inviteeEmail(), role: 'MARKETING' }, marketing.cookie))).status).toBe(403)
    expect((await listInvitesRoute(plain('/api/v1/admin/invites', marketing.cookie))).status).toBe(403)
  })

  it('valida e-mail e papel', async () => {
    resetRateLimits()
    const admin = await createAuthenticatedUser('OWNER')
    const bad = await invite(admin.cookie, 'sem-arroba', 'INEXISTENTE')
    expect(bad.status).toBe(422)
    expect(bad.body.error.details).toMatchObject({ email: expect.any(String), role: expect.any(String) })
  })

  it('administrador não convida proprietário', async () => {
    resetRateLimits()
    const admin = await createAuthenticatedUser('ADMIN')
    expect((await invite(admin.cookie, inviteeEmail(), 'OWNER')).status).toBe(403)
    expect((await invite(admin.cookie, inviteeEmail(), 'ADMIN')).status).toBe(403)
    expect((await invite(admin.cookie, inviteeEmail(), 'ANALYST')).status).toBe(201)
  })

  it('fluxo completo: convite, conta, aceite e papel concedido; o link não vale duas vezes', async () => {
    resetRateLimits()
    const owner = await createAuthenticatedUser('OWNER')
    const email = inviteeEmail()
    const created = await invite(owner.cookie, email, 'ANALYST')
    expect(created.status).toBe(201)
    const token = tokenOf(created.body.data.link)
    expect(token.length).toBeGreaterThan(30)

    // A página pública mostra papel e situação, com o e-mail mascarado.
    const info = await lookupInvite(plain(`/api/v1/invites/${token}`), { params: Promise.resolve({ token }) })
    expect(info.status).toBe(200)
    expect((await info.json()).data).toMatchObject({ role: 'ANALYST', status: 'pending', email: expect.stringContaining('•••') })

    // Sem sessão não aceita.
    expect((await acceptInviteRoute(asJson('/api/v1/invites/accept', { token }))).status).toBe(401)

    // Conta com outro e-mail não aceita.
    const stranger = await createAuthenticatedUser('READ_ONLY')
    const wrong = await acceptInviteRoute(asJson('/api/v1/invites/accept', { token }, stranger.cookie))
    expect(wrong.status).toBe(403)

    // A conta do e-mail convidado aceita e recebe o papel.
    const invitee = await signUp(email)
    const accepted = await acceptInviteRoute(asJson('/api/v1/invites/accept', { token }, invitee.cookie))
    expect(accepted.status).toBe(200)
    expect((await accepted.json()).data.role).toBe('ANALYST')
    const granted = await db.select({ code: roles.code }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, invitee.userId))
    expect(granted.map((row) => row.code)).toEqual(['ANALYST'])

    // Segunda tentativa com o mesmo link.
    expect((await acceptInviteRoute(asJson('/api/v1/invites/accept', { token }, invitee.cookie))).status).toBe(409)
  })

  it('cancelar invalida o link e um convite novo substitui o anterior', async () => {
    resetRateLimits()
    const owner = await createAuthenticatedUser('OWNER')
    const email = inviteeEmail()

    const first = await invite(owner.cookie, email, 'SUPPORT')
    const firstToken = tokenOf(first.body.data.link)
    const second = await invite(owner.cookie, email, 'SUPPORT')
    const secondToken = tokenOf(second.body.data.link)

    const invitee = await signUp(email)
    expect((await acceptInviteRoute(asJson('/api/v1/invites/accept', { token: firstToken }, invitee.cookie))).status).toBe(410)

    const revoked = await revokeInviteRoute(plain(`/api/v1/admin/invites/${second.body.data.id}`, owner.cookie, 'DELETE'), { params: Promise.resolve({ id: second.body.data.id }) })
    expect(revoked.status).toBe(200)
    expect((await acceptInviteRoute(asJson('/api/v1/invites/accept', { token: secondToken }, invitee.cookie))).status).toBe(410)
    expect((await db.select().from(userRoles).where(eq(userRoles.userId, invitee.userId)))).toHaveLength(0)
  })

  it('convite vencido não é aceito', async () => {
    resetRateLimits()
    const owner = await createAuthenticatedUser('OWNER')
    const email = inviteeEmail()
    const created = await invite(owner.cookie, email, 'READ_ONLY')
    await db.update(adminInvites).set({ expiresAt: new Date(Date.now() - 60_000).toISOString() }).where(eq(adminInvites.id, created.body.data.id))
    const invitee = await signUp(email)
    expect((await acceptInviteRoute(asJson('/api/v1/invites/accept', { token: tokenOf(created.body.data.link) }, invitee.cookie))).status).toBe(410)
  })

  it('token desconhecido responde 404 e não vaza nada', async () => {
    resetRateLimits()
    const response = await lookupInvite(plain('/api/v1/invites/inventado'), { params: Promise.resolve({ token: 'inventado' }) })
    expect(response.status).toBe(404)
  })
})
