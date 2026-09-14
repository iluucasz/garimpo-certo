'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ExternalLink, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { adminConfigs } from '@/lib/admin-config'
import { useSession } from '@/lib/auth/client'
import { AdminAccessProvider, useAdminAccess } from './admin-access'

const roleLabels: Record<string, string> = { OWNER: 'Proprietário', ADMIN: 'Administrador', MARKETING: 'Marketing', CATALOG_MANAGER: 'Gestor de catálogo', ANALYST: 'Analista', SUPPORT: 'Suporte', READ_ONLY: 'Leitor' }

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminAccessProvider><Shell>{children}</Shell></AdminAccessProvider>
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = useSession()
  const { roles, loading: rolesLoading, allowed } = useAdminAccess()
  const [navigationOpen, setNavigationOpen] = useState(false)

  useEffect(() => {
    if (sessionPending || rolesLoading) return
    if (!session) { router.push('/entrar'); return }
    if (roles.length === 0) router.push('/')
  }, [sessionPending, rolesLoading, session, roles, router])

  if (sessionPending || rolesLoading) return <div className="admin-shell"><div className="admin-content container">Carregando…</div></div>
  if (!session || roles.length === 0) return null

  const visible = adminConfigs.filter((item) => allowed(item.slug))
  const groups = [...new Set(visible.map((item) => item.group))]
  const closeNavigation = () => setNavigationOpen(false)

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-head">
        <Link href="/admin" className="brand" onClick={closeNavigation}><span>G</span>arimpo ops</Link>
        <button className="admin-sidebar-toggle" aria-label={navigationOpen ? 'Fechar navegação administrativa' : 'Abrir navegação administrativa'} aria-expanded={navigationOpen} aria-controls="admin-navigation" onClick={() => setNavigationOpen((current) => !current)}>{navigationOpen ? <X/> : <Menu/>}</button>
      </div>
      <nav id="admin-navigation" className={navigationOpen ? 'admin-nav open' : 'admin-nav'} aria-label="Administração">
        <Link className={pathname === '/admin' ? 'active' : ''} href="/admin" onClick={closeNavigation}>Visão geral</Link>
        {groups.map((group) => <div className="admin-nav-group" key={group}><strong>{group}</strong>{visible.filter((item) => item.group === group).map((item) => <Link className={pathname === `/admin/${item.slug}` ? 'active' : ''} href={`/admin/${item.slug}`} onClick={closeNavigation} key={item.slug}>{item.title}</Link>)}</div>)}
      </nav>
    </aside>
    <main className="admin-main">
      <header className="admin-header">
        <div className="breadcrumbs">Operação / Garimpo</div>
        <div className="admin-header-actions">
          <span className="role-switch"><ShieldCheck/><span>{roles.map((role) => roleLabels[role] ?? role).join(', ')}</span></span>
          <button className="icon-btn" style={{ position: 'static' }} aria-label="Buscar"><Search/></button>
          <button className="icon-btn" style={{ position: 'static' }} aria-label="Notificações"><Bell/></button>
          <Link href="/" className="btn secondary">Ver storefront <ExternalLink/></Link>
        </div>
      </header>
      <div className="admin-content">{children}</div>
    </main>
  </div>
}
