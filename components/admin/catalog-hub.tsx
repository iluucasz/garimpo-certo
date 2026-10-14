'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Boxes, DatabaseZap, FolderTree, Layers, PackageSearch, Plug, Store, Tag, Tags } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { dateTime, swrFetcher } from '@/lib/admin/client'
import { useAdminAccess } from './admin-access'
import styles from './catalog-hub.module.css'

type Overview = {
  counts: Record<'produtos' | 'ofertas' | 'categorias' | 'marcas' | 'tags' | 'colecoes' | 'providers', number>
  lastImport: { at: string; status: string } | null
}

type Tab = { slug: string; label: string; icon: LucideIcon; count?: keyof Overview['counts'] }
const sections: { title: string; hint: string; tabs: Tab[] }[] = [
  { title: 'O que você vende', hint: 'Itens do catálogo', tabs: [
    { slug: 'produtos', label: 'Produtos', icon: PackageSearch, count: 'produtos' },
    { slug: 'ofertas', label: 'Ofertas', icon: Tag, count: 'ofertas' },
  ] },
  { title: 'Como se organiza', hint: 'Agrupamentos da vitrine', tabs: [
    { slug: 'categorias', label: 'Categorias', icon: FolderTree, count: 'categorias' },
    { slug: 'marcas', label: 'Lojas', icon: Store, count: 'marcas' },
    { slug: 'tags', label: 'Selos', icon: Tags, count: 'tags' },
    { slug: 'colecoes', label: 'Coleções', icon: Layers, count: 'colecoes' },
  ] },
  { title: 'De onde vem', hint: 'Fontes e atualização', tabs: [
    { slug: 'imports-jobs', label: 'Importações', icon: DatabaseZap },
    { slug: 'providers', label: 'Provedores', icon: Plug, count: 'providers' },
  ] },
]

const statusText: Record<string, { label: string; tone: 'ok' | 'bad' | 'run' }> = {
  succeeded: { label: 'concluída', tone: 'ok' },
  failed: { label: 'falhou', tone: 'bad' },
  running: { label: 'em andamento', tone: 'run' },
  partial: { label: 'parcial', tone: 'bad' },
}

/** Navegação do catálogo: as 8 telas agrupadas por assunto, com a contagem de cada uma. */
export function CatalogHub() {
  const pathname = usePathname()
  const { allowed } = useAdminAccess()
  const { data } = useSWR<Overview>('/api/v1/admin/catalog-overview', swrFetcher, { revalidateOnFocus: false })
  const import_ = data?.lastImport
  const state = import_ ? statusText[import_.status] ?? { label: import_.status || '—', tone: 'run' as const } : null

  return <nav className={styles.hub} aria-label="Seções do catálogo">
    <div className={styles.groups}>
      {sections.map((section) => {
        const tabs = section.tabs.filter((tab) => allowed(tab.slug))
        if (tabs.length === 0) return null
        return <section key={section.title} className={styles.group} aria-label={section.title}>
          <header><strong>{section.title}</strong></header>
          <ul>
            {tabs.map((tab) => {
              const active = pathname === `/admin/${tab.slug}`
              const Icon = tab.icon
              const count = tab.count ? data?.counts[tab.count] : undefined
              return <li key={tab.slug}>
                <Link href={`/admin/${tab.slug}`} className={`${styles.tab} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined}>
                  <Icon aria-hidden="true"/>
                  <span>{tab.label}</span>
                  {count !== undefined && <b>{count.toLocaleString('pt-BR')}</b>}
                </Link>
              </li>
            })}
          </ul>
        </section>
      })}
    </div>
    {import_ && state && <p className={styles.sync}>
      <Boxes aria-hidden="true"/>
      <span>Última importação <strong>{dateTime(import_.at)}</strong></span>
      <i className={`${styles.dot} ${styles[state.tone]}`} aria-hidden="true"/>
      <span>{state.label}</span>
    </p>}
  </nav>
}
