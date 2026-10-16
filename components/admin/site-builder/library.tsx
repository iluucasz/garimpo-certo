'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { sectionTypeList, sectionTypes, type SectionType, type SiteDocument } from '@/lib/site-builder/document'
import styles from './site-builder.module.css'

export const NEW_SECTION_MIME = 'application/x-garimpo-new-section'

type Props = {
  document: SiteDocument
  /** Páginas criadas no painel só aceitam blocos livres. */
  freeOnly: boolean
  canWrite: boolean
  full: boolean
  onAdd: (type: SectionType) => void
  onRestore: (id: string) => void
  onDragType: (type: SectionType | null) => void
}

/** Biblioteca de componentes: busca, arraste para a lista ou clique para adicionar depois da seção escolhida. */
export function Library({ document, freeOnly, canWrite, full, onAdd, onRestore, onDragType }: Props) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (type: SectionType) => !needle || `${sectionTypes[type].label} ${sectionTypes[type].description}`.toLowerCase().includes(needle)
    return [
      { id: 'site', title: 'Seções do site', items: freeOnly ? [] : sectionTypeList.filter((type) => sectionTypes[type].builtin && matches(type)) },
      { id: 'free', title: 'Blocos de conteúdo', items: sectionTypeList.filter((type) => !sectionTypes[type].builtin && matches(type)) },
    ].filter((group) => group.items.length > 0)
  }, [query, freeOnly])

  return <div className={styles.library}>
    <label className={styles.searchField}>
      <Search aria-hidden="true"/>
      <input type="search" value={query} placeholder="Buscar componente" aria-label="Buscar componente" onChange={(event) => setQuery(event.target.value)}/>
    </label>
    {full && <p className={styles.warn} role="status">A página chegou ao limite de seções. Apague uma arquivada para adicionar outra.</p>}
    {groups.length === 0 && <p className={styles.help}>Nenhum componente com “{query}”.</p>}
    {groups.map((group) => <section key={group.id} aria-label={group.title}>
      <h3>{group.title}</h3>
      <ul>
        {group.items.map((type) => {
          const definition = sectionTypes[type]
          const existing = definition.builtin ? document.sections.find((section) => section.type === type) : undefined
          const blocked = !canWrite || (!existing && full)
          return <li key={type}>
            <button
              type="button"
              className={styles.libraryItem}
              title={definition.description}
              disabled={blocked || (Boolean(existing) && !existing?.archived)}
              draggable={!blocked && !existing}
              onDragStart={(event) => { event.dataTransfer.setData(NEW_SECTION_MIME, type); event.dataTransfer.effectAllowed = 'copy'; onDragType(type) }}
              onDragEnd={() => onDragType(null)}
              onClick={() => existing?.archived ? onRestore(existing.id) : onAdd(type)}
            >
              <strong>{definition.label}</strong>
              {existing && <small>{existing.archived ? 'Arquivada: restaurar' : 'Já está na página'}</small>}
            </button>
          </li>
        })}
      </ul>
    </section>)}
  </div>
}
