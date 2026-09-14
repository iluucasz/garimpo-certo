export type AdminRole = 'OWNER' | 'ADMIN' | 'MARKETING' | 'CATALOG_MANAGER' | 'ANALYST' | 'SUPPORT' | 'READ_ONLY'
export type Permission = 'catalog:read' | 'catalog:write' | 'content:write' | 'analytics:read' | 'jobs:run' | 'settings:write' | 'users:manage'

// Fonte de verdade dos dados: tabela `roles` (jsonb `permissions`, seedada por lib/db/seed-roles.ts).
// Mantido aqui só como referência/documentação do mapeamento seedado.
export const defaultRolePermissions: Record<AdminRole, Permission[]> = {
  OWNER: ['catalog:read', 'catalog:write', 'content:write', 'analytics:read', 'jobs:run', 'settings:write', 'users:manage'],
  ADMIN: ['catalog:read', 'catalog:write', 'content:write', 'analytics:read', 'jobs:run', 'settings:write', 'users:manage'],
  MARKETING: ['catalog:read', 'content:write', 'analytics:read'],
  CATALOG_MANAGER: ['catalog:read', 'catalog:write', 'jobs:run'],
  ANALYST: ['catalog:read', 'analytics:read'],
  SUPPORT: ['catalog:read'],
  READ_ONLY: ['catalog:read'],
}

export function permissionForModule(slug: string, mutation = false): Permission {
  if (['analytics', 'funil', 'eventos'].includes(slug)) return 'analytics:read'
  if (slug === 'imports-jobs') return mutation ? 'jobs:run' : 'catalog:read'
  if (['usuarios-rbac', 'seguranca'].includes(slug)) return 'users:manage'
  if (['tracking', 'ai', 'tema', 'integracoes'].includes(slug)) return mutation ? 'settings:write' : 'catalog:read'
  if (['cms', 'paginas', 'seo'].includes(slug)) return mutation ? 'content:write' : 'catalog:read'
  return mutation ? 'catalog:write' : 'catalog:read'
}
