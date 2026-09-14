import { eq } from 'drizzle-orm'
import { db } from './client'
import { roles, userRoles, users } from './schema'
import type { AdminRole } from '../auth/rbac'

const [, , email, code] = process.argv

async function main() {
  if (!email || !code) {
    console.error('Uso: pnpm db:grant-role <email> <ROLE_CODE>')
    console.error('Papéis: OWNER, ADMIN, MARKETING, CATALOG_MANAGER, ANALYST, SUPPORT, READ_ONLY')
    process.exit(1)
  }
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (!user) throw new Error(`Usuário não encontrado: ${email}`)
  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, code as AdminRole))
  if (!role) throw new Error(`Papel não encontrado: ${code}. Rode "pnpm db:seed-roles" primeiro.`)
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id }).onConflictDoNothing()
  console.log(`${email} agora tem o papel ${code}.`)
  process.exit(0)
}

main().catch((error) => { console.error(error); process.exit(1) })
