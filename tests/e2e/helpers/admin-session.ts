import { eq, inArray } from 'drizzle-orm'
import type { BrowserContext } from '@playwright/test'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/client'
import { roles, userRoles, users } from '@/lib/db/schema'

/**
 * Sessão real de administrador para os e2e: cria uma conta de verdade pelo Better Auth, concede o papel direto
 * no banco e entrega o cookie. Nada de resposta simulada; o painel e as rotas validam como em produção.
 */
export async function createAdminSession(role: 'OWNER' | 'ADMIN' | 'MARKETING' = 'OWNER') {
  const email = `e2e-${crypto.randomUUID()}@example.com`
  const response = await auth.api.signUpEmail({ body: { email, password: 'senha-e2e-123', name: 'Admin E2E' }, asResponse: true })
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Cadastro de teste não devolveu cookie de sessão.')
  const [pair] = setCookie.split(';')
  const separator = pair.indexOf('=')
  const userId = (await response.clone().json()).user.id as string
  const [roleRow] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, role))
  if (!roleRow) throw new Error(`Papel ${role} não existe. Rode "pnpm db:seed-roles".`)
  await db.insert(userRoles).values({ userId, roleId: roleRow.id }).onConflictDoNothing()
  return {
    userId,
    cookie: { name: pair.slice(0, separator), value: pair.slice(separator + 1) },
    async apply(context: BrowserContext, host = 'localhost') {
      await context.addCookies([{ name: this.cookie.name, value: this.cookie.value, domain: host, path: '/', httpOnly: true, sameSite: 'Lax' }])
    },
  }
}

export async function removeUsers(ids: string[]) {
  if (ids.length) await db.delete(users).where(inArray(users.id, ids))
}
