import { eq } from 'drizzle-orm'
import { defaultRolePermissions } from '../auth/rbac'
import { db } from './client'
import { roles } from './schema'

async function main() {
  for (const [code, permissions] of Object.entries(defaultRolePermissions)) {
    const existing = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, code as keyof typeof defaultRolePermissions))
    if (existing.length) {
      await db.update(roles).set({ permissions }).where(eq(roles.code, code as keyof typeof defaultRolePermissions))
      console.log(`Atualizado: ${code}`)
    } else {
      await db.insert(roles).values({ code: code as keyof typeof defaultRolePermissions, permissions })
      console.log(`Criado: ${code}`)
    }
  }
  process.exit(0)
}

main().catch((error) => { console.error(error); process.exit(1) })
