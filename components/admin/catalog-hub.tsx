'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Boxes, DatabaseZap, FileCheck2, FlaskConical, FolderTree, Gauge, Home, Layers, LayoutTemplate, ListOrdered, Megaphone, PackageSearch, Plug, Ruler, Store, Tag, Tags, ToggleRight, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { dateTime, swrFetcher } from '@/lib/admin/client'
import { useAdminAccess } from './admin-access'
import styles from './catalog-hub.module.css'

type Tab = { slug: string; label: string; icon: LucideIcon; count?: string }
type Section = { title: string; tabs: Tab[] }

/** Menu em abas de cada área do painel: as telas agrupadas por assunto, com a contagem de cada uma. */
const hubs: Record<'Catálogo' | 'Experiência', { label: string; endpoint: string; sections: Section[] }> = {
  Catálogo: {
    label: 'Seções do catálogo',
    endpoint: '/api/v1/admin/catalog-overview',
    sections: [
      { title: 'O que você vende', tabs: [
        { slug: 'produtos', label: 'Produtos', icon: PackageSearch, count: 'produtos' },
        { slug: 'ofertas', label: 'Ofertas', icon: Tag, count: 'ofertas' },
      ] },
      { title: 'Como se organiza', tabs: [
        { slug: 'categorias', label: 'Categorias', icon: FolderTree, count: 'categorias' },
        { slug: 'marcas', label: 'Lojas', icon: Store, count: 'marcas' },
        { slug: 'tags', label: 'Selos', icon: Tags, count: 'tags' },
        { slug: 'colecoes', label: 'Coleções', icon: Layers, count: 'colecoes' },
      ] },
      { title: 'De onde vem', tabs: [
        { slug: 'imports-jobs', label: 'Importações', icon: DatabaseZap },
        { slug: 'providers', label: 'Provedores', icon: Plug, count: 'providers' },
      ] },
    ],
  },
  Experiência: {
    label: 'Seções de experiência',
    endpoint: '/api/v1/admin/experience-overview',
    sections: [
      { title: 'Páginas e vitrine', tabs: [
        { slug: 'home-builder', label: 'Home e páginas', icon: LayoutTemplate },
        { slug: 'campanhas', label: 'Campanhas', icon: Megaphone, count: 'campanhas' },
      ] },
      { title: 'Regras de exibição', tabs: [
        { slug: 'ranking', label: 'Ranking', icon: ListOrdered },
        { slug: 'regras-catalogo', label: 'Regras do catálogo', icon: Ruler },
        { slug: 'recommendation-slots', label: 'Recomendações', icon: Gauge },
      ] },
      { title: 'Medir e testar', tabs: [
        { slug: 'testes-ab', label: 'Testes A/B', icon: FlaskConical, count: 'testes' },
        { slug: 'segmentos', label: 'Segmentos', icon: Users, count: 'segmentos' },
        { slug: 'experimentos', label: 'Recursos', icon: ToggleRight, count: 'flags' },
      ] },
    ],
  },
}

type Overview = {
  counts: Record<string, number>
  lastImport?: { at: string; status: string } | null
  home?: { publishedAt: string | null; hasDraft: boolean }
}

const importStatus: Record<string, { label: string; tone: 'ok' | 'bad' | 'run' }> = {
  succeeded: { label: 'concluída', tone: 'ok' },
  failed: { label: 'falhou', tone: 'bad' },
  running: { label: 'em andamento', tone: 'run' },
  partial: { label: 'parcial', tone: 'bad' },
}

export function CatalogHub({ group = 'Catálogo' }: { group?: 'Catálogo' | 'Experiência' }) {
  const hub = hubs[group]
  const pathname = usePathname()
  const { allowed } = useAdminAccess()
  const { data } = useSWR<Overview>(hub.endpoint, swrFetcher, { revalidateOnFocus: false })

  let status: { icon: LucideIcon; text: string; tone: 'ok' | 'bad' | 'run' | 'muted' } | null = null
  if (group === 'Catálogo' && data?.lastImport) {
    const state = importStatus[data.lastImport.status] ?? { label: data.lastImport.status || '—', tone: 'run' as const }
    status = { icon: Boxes, text: `Última importação ${dateTime(data.lastImport.at)} · ${state.label}`, tone: state.tone }
  }
  if (group === 'Experiência' && data?.home) {
    status = data.home.publishedAt
      ? { icon: FileCheck2, text: `Home publicada em ${dateTime(data.home.publishedAt)}${data.home.hasDraft ? ' · há rascunho não publicado' : ''}`, tone: data.home.hasDraft ? 'run' : 'ok' }
      : { icon: Home, text: 'Home no formato original (nada publicado pelo editor)', tone: 'muted' }
  }

  return <nav className={styles.hub} aria-label={hub.label}>
    <div className={styles.groups}>
      {hub.sections.map((section) => {
        const tabs = section.tabs.filter((tab) => allowed(tab.slug))
        if (tabs.length === 0) return null
        return <section key={section.title} className={styles.group} aria-label={section.title}>
          <header><strong>{section.title}</strong></header>
          <ul>
            {tabs.map((tab) => {
              const active = pathname === `/admin/${tab.slug}`
              const count = tab.count ? data?.counts[tab.count] : undefined
              return <li key={tab.slug}>
                <Link href={`/admin/${tab.slug}`} className={`${styles.tab} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined}>
                  <span>{tab.label}</span>
                  {count !== undefined && <b>{count.toLocaleString('pt-BR')}</b>}
                </Link>
              </li>
            })}
          </ul>
        </section>
      })}
    </div>
    {status && <p className={styles.sync}>
      <status.icon aria-hidden="true"/>
      <span>{status.text}</span>
      <i className={`${styles.dot} ${status.tone === 'muted' ? '' : styles[status.tone]}`} aria-hidden="true"/>
    </p>}
  </nav>
}
