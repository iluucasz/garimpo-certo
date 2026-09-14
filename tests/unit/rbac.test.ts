import { describe, expect, it } from 'vitest'
import { defaultRolePermissions, permissionForModule } from '@/lib/auth/rbac'
describe('RBAC', () => {
  it('nega mutação de catálogo ao papel somente leitura', () => expect(defaultRolePermissions.READ_ONLY.includes('catalog:write')).toBe(false))
  it('permite analytics ao analista', () => expect(defaultRolePermissions.ANALYST.includes('analytics:read')).toBe(true))
  it('concede todas as permissões a OWNER e ADMIN', () => {
    expect(defaultRolePermissions.OWNER).toHaveLength(7)
    expect(defaultRolePermissions.ADMIN).toHaveLength(7)
  })
  it('mapeia jobs para permissão operacional', () => expect(permissionForModule('imports-jobs', true)).toBe('jobs:run'))
  it('reserva usuários ao gerenciamento de acesso', () => expect(permissionForModule('usuarios-rbac')).toBe('users:manage'))
})
