import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { symmetricDecrypt } from 'better-auth/crypto'
import { GET as listInvitesRoute } from '@/app/api/v1/admin/invites/route'
import { GET as meRoute } from '@/app/api/v1/me/route'
import { auth } from '@/lib/auth/auth'
import { MFA_ROLES, mfaEnforced, needsMfa } from '@/lib/auth/mfa'
import { db } from '@/lib/db/client'
import { twoFactor, users } from '@/lib/db/schema'
import { createAuthenticatedUser } from '../helpers/auth'

const PASSWORD = 'senha-teste-123'
const request = (path: string, cookie: string) => new Request(`http://localhost${path}`, { headers: { cookie } })

afterEach(() => { delete process.env.ADMIN_REQUIRE_MFA })

/** Cabeçalhos `set-cookie` de uma resposta viram o valor do cabeçalho `cookie` da próxima chamada. */
const cookieFrom = (response: Response) => (response.headers.get('set-cookie') ?? '')
  .split(/,(?=\s*[^;,]+=)/).map((part) => part.split(';')[0].trim()).filter(Boolean).join('; ')

/**
 * Liga o 2FA da conta pela API do servidor, gerando o código como um aplicativo autenticador faria.
 * Ao confirmar o primeiro código o Better Auth emite uma sessão nova; `cookie` é a que vale daí em diante.
 */
async function enableTwoFactor(cookie: string, userId: string) {
  const headers = new Headers({ cookie })
  const enabled = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers })
  if (!('totpURI' in enabled)) throw new Error('Esperava o método TOTP.')
  expect(enabled.totpURI).toContain('otpauth://totp/')
  const [row] = await db.select({ secret: twoFactor.secret }).from(twoFactor).where(eq(twoFactor.userId, userId))
  const secret = await symmetricDecrypt({ key: process.env.BETTER_AUTH_SECRET!, data: row.secret })
  const { code } = await auth.api.generateTOTP({ body: { secret } })
  const verified = await auth.api.verifyTOTP({ body: { code }, headers, asResponse: true })
  expect(verified.status).toBe(200)
  return { secret, backupCodes: enabled.backupCodes, cookie: cookieFrom(verified) || cookie }
}

describe('regras puras de MFA', () => {
  it('só OWNER e ADMIN precisam', () => {
    expect(MFA_ROLES).toEqual(['OWNER', 'ADMIN'])
    expect(needsMfa(['MARKETING', 'ANALYST'])).toBe(false)
    expect(needsMfa(['MARKETING', 'ADMIN'])).toBe(true)
    expect(needsMfa([])).toBe(false)
  })

  it('a exigência vem desligada por padrão', () => {
    expect(mfaEnforced()).toBe(false)
    process.env.ADMIN_REQUIRE_MFA = '1'
    expect(mfaEnforced()).toBe(true)
  })
})

describe('verificação em duas etapas', () => {
  it('ativa com o código do aplicativo e passa a pedir o segundo passo no login', async () => {
    const admin = await createAuthenticatedUser('MARKETING')
    const before = await db.select({ enabled: users.twoFactorEnabled }).from(users).where(eq(users.id, admin.userId))
    expect(before[0].enabled).toBe(false)

    const { secret } = await enableTwoFactor(admin.cookie, admin.userId)
    const after = await db.select({ enabled: users.twoFactorEnabled }).from(users).where(eq(users.id, admin.userId))
    expect(after[0].enabled).toBe(true)

    // Novo login: a senha sozinha não abre a sessão.
    const login = await auth.api.signInEmail({ body: { email: admin.email, password: PASSWORD }, asResponse: true })
    const body = await login.clone().json()
    expect(body.twoFactorRedirect).toBe(true)
    const challengeCookie = cookieFrom(login)

    // Código errado é recusado; o certo abre a sessão.
    await expect(auth.api.verifyTOTP({ body: { code: '000000' }, headers: new Headers({ cookie: challengeCookie }) })).rejects.toBeTruthy()
    const { code } = await auth.api.generateTOTP({ body: { secret } })
    const verified = await auth.api.verifyTOTP({ body: { code }, headers: new Headers({ cookie: challengeCookie }), asResponse: true })
    expect(verified.status).toBe(200)
    expect(verified.headers.get('set-cookie')).toContain('session_token')
  })

  it('código de recuperação vale uma vez', async () => {
    const user = await createAuthenticatedUser('ANALYST')
    const { backupCodes } = await enableTwoFactor(user.cookie, user.userId)
    expect(backupCodes.length).toBeGreaterThan(5)

    const login = await auth.api.signInEmail({ body: { email: user.email, password: PASSWORD }, asResponse: true })
    const challengeCookie = cookieFrom(login)
    const first = await auth.api.verifyBackupCode({ body: { code: backupCodes[0] }, headers: new Headers({ cookie: challengeCookie }), asResponse: true })
    expect(first.status).toBe(200)

    const again = await auth.api.signInEmail({ body: { email: user.email, password: PASSWORD }, asResponse: true })
    const secondCookie = cookieFrom(again)
    await expect(auth.api.verifyBackupCode({ body: { code: backupCodes[0] }, headers: new Headers({ cookie: secondCookie }) })).rejects.toBeTruthy()
  })
})

describe('exigência de MFA no painel (ADMIN_REQUIRE_MFA=1)', () => {
  it('com a exigência desligada, administrador sem MFA continua entrando', async () => {
    const admin = await createAuthenticatedUser('ADMIN')
    expect((await listInvitesRoute(request('/api/v1/admin/invites', admin.cookie))).status).toBe(200)
    const me = await (await meRoute(request('/api/v1/me', admin.cookie))).json()
    expect(me.data.mfa).toMatchObject({ enabled: false, required: true, enforced: false })
  })

  it('com a exigência ligada, bloqueia OWNER/ADMIN sem MFA e libera quem ativou', async () => {
    const withoutMfa = await createAuthenticatedUser('ADMIN')
    const withMfa = await createAuthenticatedUser('OWNER')
    const activated = await enableTwoFactor(withMfa.cookie, withMfa.userId)
    process.env.ADMIN_REQUIRE_MFA = '1'

    const blocked = await listInvitesRoute(request('/api/v1/admin/invites', withoutMfa.cookie))
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).error.details).toEqual({ code: 'MFA_REQUIRED' })

    expect((await listInvitesRoute(request('/api/v1/admin/invites', activated.cookie))).status).toBe(200)
  })

  it('papéis que não pedem MFA não são afetados', async () => {
    process.env.ADMIN_REQUIRE_MFA = '1'
    const marketing = await createAuthenticatedUser('MARKETING')
    // MARKETING não tem `users:manage`, então o 403 aqui é de permissão, não de MFA.
    const response = await listInvitesRoute(request('/api/v1/admin/invites', marketing.cookie))
    expect(response.status).toBe(403)
    expect((await response.json()).error.details).toBeUndefined()
  })
})
