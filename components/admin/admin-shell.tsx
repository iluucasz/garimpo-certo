'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowUpRight, BarChart3, ChevronDown, ChevronRight, FileText,
  LayoutDashboard, Menu, Package, Search, Settings2, ShieldCheck, SlidersHorizontal, X,
  type LucideIcon,
} from 'lucide-react'
import { adminConfigs } from '@/lib/admin-config'
import { useSession } from '@/lib/auth/client'
import { AdminAccessProvider, useAdminAccess } from './admin-access'
import styles from './admin.module.css'

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietário', ADMIN: 'Administrador', MARKETING: 'Marketing',
  CATALOG_MANAGER: 'Gestor de catálogo', ANALYST: 'Analista', SUPPORT: 'Suporte', READ_ONLY: 'Leitor',
}
const groupIcons: Record<string, LucideIcon> = {
  Catálogo: Package, Experiência: SlidersHorizontal, Conteúdo: FileText,
  Insights: BarChart3, Governança: ShieldCheck, Sistema: Settings2,
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminAccessProvider><Shell>{children}</Shell></AdminAccessProvider>
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = useSession()
  const { roles, loading: rolesLoading, allowed } = useAdminAccess()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (sessionPending || rolesLoading) return
    if (!session) { router.push('/entrar'); return }
    if (roles.length === 0) router.push('/')
  }, [sessionPending, rolesLoading, session, roles, router])

  if (sessionPending || rolesLoading) return <div className={`admin-shell ${styles.workspace}`}><div className={styles.loading} role="status">Carregando painel…</div></div>
  if (!session || roles.length === 0) return null

  const currentModule = adminConfigs.find((item) => pathname === `/admin/${item.slug}`)
  const visible = adminConfigs.filter((item) => allowed(item.slug))
  const groups = [...new Set(visible.map((item) => item.group))]
  const filtered = visible.filter((item) => normalize(`${item.title} ${item.group}`).includes(normalize(query.trim())))
  const closeNavigation = () => { setNavigationOpen(false); setQuery('') }
  const userName = session.user.name || 'Minha conta'
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('')

  return <div className={`admin-shell ${styles.workspace}`}>
    <a className={styles.skipLink} href="#admin-content">Ir para o conteúdo</a>
    <aside className="admin-sidebar">
      <div className="admin-sidebar-head">
        <Link href="/admin" className={styles.wordmark} onClick={closeNavigation} aria-label="Garimpo, painel administrativo">
          <span className={styles.brandMark}>g</span><span>garimpo<span className={styles.ops}>ops</span></span>
        </Link>
        <button className="admin-sidebar-toggle" aria-label={navigationOpen ? 'Fechar navegação administrativa' : 'Abrir navegação administrativa'} aria-expanded={navigationOpen} aria-controls="admin-navigation" onClick={() => setNavigationOpen((current) => !current)}>{navigationOpen ? <X/> : <Menu/>}</button>
      </div>
      <nav id="admin-navigation" className={navigationOpen ? 'admin-nav open' : 'admin-nav'} aria-label="Administração" onKeyDown={(event) => { if (event.key === 'Escape') { setNavigationOpen(false); document.querySelector<HTMLButtonElement>('.admin-sidebar-toggle')?.focus() } }}>
        <label className={styles.navSearch}><Search aria-hidden="true"/><input type="search" aria-label="Buscar no menu" placeholder="Buscar no menu" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        {!query.trim() && <Link className={`admin-overview-link ${pathname === '/admin' ? 'active' : ''}`} aria-current={pathname === '/admin' ? 'page' : undefined} href="/admin" onClick={closeNavigation}><LayoutDashboard aria-hidden="true"/>Visão geral</Link>}
        <span className={styles.navLabel}>Workspace</span>
        {groups.map((group) => {
          const items = filtered.filter((item) => item.group === group)
          if (!items.length) return null
          const Icon = groupIcons[group] ?? Settings2
          const isCurrentGroup = currentModule?.group === group
          const isOpen = Boolean(query.trim()) || (expanded[`${pathname}:${group}`] ?? (isCurrentGroup || (!currentModule && group === 'Catálogo')))
          const id = `nav-${normalize(group)}`
          return <div className={styles.navGroup} key={group}>
            <button className={`${styles.groupTrigger} ${isCurrentGroup ? styles.currentGroup : ''}`} aria-expanded={isOpen} aria-controls={id} onClick={() => setExpanded((previous) => ({ ...previous, [`${pathname}:${group}`]: !isOpen }))}>
              <Icon aria-hidden="true"/><span>{group}</span><ChevronDown className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true"/>
            </button>
            <div id={id} className={styles.groupLinks} hidden={!isOpen}>
              {items.map((item) => <Link className={pathname === `/admin/${item.slug}` ? 'active' : ''} aria-current={pathname === `/admin/${item.slug}` ? 'page' : undefined} href={`/admin/${item.slug}`} onClick={closeNavigation} key={item.slug}>{item.title}</Link>)}
            </div>
          </div>
        })}
        {filtered.length === 0 && <p className={styles.noResults}>Nenhuma seção encontrada.</p>}
      </nav>
      <Link href="/conta" className={styles.sidebarAccount}>
        <span className={styles.avatar}>{initials}</span><span className={styles.accountCopy}><strong>{userName}</strong><small>{roles.map((role) => roleLabels[role] ?? role).join(', ')}</small></span><ChevronRight aria-hidden="true"/>
      </Link>
    </aside>
    <main className="admin-main">
      <header className="admin-header">
        <nav className="breadcrumbs" aria-label="Caminho da página"><Link href="/admin">Workspace</Link><ChevronRight aria-hidden="true"/>{currentModule && <><span>{currentModule.group}</span><ChevronRight aria-hidden="true"/></>}<span aria-current="page">{currentModule?.title ?? 'Visão geral'}</span></nav>
        <div className="admin-header-actions"><Link href="/" className={styles.storeLink}>Ver loja <ArrowUpRight aria-hidden="true"/></Link></div>
      </header>
      <div id="admin-content" className="admin-content" tabIndex={-1}>{children}</div>
    </main>
  </div>
}
