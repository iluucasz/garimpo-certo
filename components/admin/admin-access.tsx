'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { permissionForModule, type AdminRole, type Permission } from '@/lib/auth/rbac'

type AccessContext = { roles: AdminRole[]; permissions: Permission[]; loading: boolean; allowed: (slug: string, mutation?: boolean) => boolean }
const Context = createContext<AccessContext | null>(null)

type MeResponse = { data: { roles: { code: AdminRole; permissions: Permission[] }[] } }

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/me')
      .then((response) => response.ok ? response.json() as Promise<MeResponse> : null)
      .then((body) => {
        const rows = body?.data.roles ?? []
        setRoles(rows.map((row) => row.code))
        setPermissions([...new Set(rows.flatMap((row) => row.permissions))])
      })
      .finally(() => setLoading(false))
  }, [])

  return <Context.Provider value={{ roles, permissions, loading, allowed: (slug, mutation = false) => permissions.includes(permissionForModule(slug, mutation)) }}>{children}</Context.Provider>
}
export function useAdminAccess() { const value = useContext(Context); if (!value) throw new Error('useAdminAccess deve estar dentro de AdminAccessProvider'); return value }
