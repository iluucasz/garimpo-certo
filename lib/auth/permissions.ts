import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { roles, userRoles } from '@/lib/db/schema'
import type { AdminRole, Permission } from './rbac'

export async function getUserRoles(userId: string): Promise<{ code: AdminRole; permissions: Permission[] }[]> {
  const rows = await db
    .select({ code: roles.code, permissions: roles.permissions })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
  return rows.map((row) => ({ code: row.code as AdminRole, permissions: row.permissions as Permission[] }))
}

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const assigned = await getUserRoles(userId)
  return [...new Set(assigned.flatMap((role) => role.permissions))]
}

export async function userHasPermission(userId: string, permission: Permission): Promise<boolean> {
  return (await getUserPermissions(userId)).includes(permission)
}

export async function isStaff(userId: string): Promise<boolean> {
  return (await getUserRoles(userId)).length > 0
}
