import { afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { roles, userRoles, users } from '@/lib/db/schema'
import { auth } from '@/lib/auth/auth'
import type { AdminRole } from '@/lib/auth/rbac'

const createdUserIds: string[] = []

afterAll(async () => {
  if (createdUserIds.length) await db.delete(users).where(inArray(users.id, createdUserIds))
})

export async function createAuthenticatedUser(role: AdminRole) {
  const email = `test-${crypto.randomUUID()}@example.com`
  const response = await auth.api.signUpEmail({ body: { email, password: 'senha-teste-123', name: 'Teste' }, asResponse: true })
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Sign-up de teste não retornou cookie de sessão.')
  const cookie = setCookie.split(';')[0]
  const userId = (await response.clone().json()).user.id as string
  createdUserIds.push(userId)

  const [roleRow] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, role))
  if (!roleRow) throw new Error(`Papel ${role} não seedado. Rode "pnpm db:seed-roles".`)
  await db.insert(userRoles).values({ userId, roleId: roleRow.id }).onConflictDoNothing()

  return { userId, email, cookie }
}
