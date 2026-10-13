'use client'

import { LockKeyhole } from 'lucide-react'
import { useVisitorState } from '@/components/visitor-state-provider'
import { useStoreData } from '@/components/store-data-provider'
import { ProductGrid } from '@/components/product/product-card'
import { ContentSkeleton } from './store-loading'
import { EmptyCollection, PersonalHeading, SuggestedProducts } from './personal-page-parts'
import styles from './personal-pages.module.css'

export function HistoryCollection() {
  const { recent, clearHistory, hydrated } = useVisitorState()
  const { products } = useStoreData()
  if (!hydrated) return <ContentSkeleton/>
  const items = recent.flatMap((id) => { const product = products.find((item) => item.id === id); return product ? [product] : [] })

  return <div className={`container ${styles.page}`}><PersonalHeading mode="history"/>
    {items.length
      ? <><div className={styles.toolbar}><p><strong>{items.length}</strong> {items.length === 1 ? 'produto visto' : 'produtos vistos'}</p><button type="button" onClick={clearHistory}>Limpar histórico</button></div><section aria-labelledby="history-products-title"><h2 id="history-products-title" className="sr-only">Produtos vistos recentemente</h2><ProductGrid items={items}/></section></>
      : <><EmptyCollection mode="history"/><SuggestedProducts mode="history"/></>}
    <p className={styles.localNote}><LockKeyhole aria-hidden="true"/>O histórico fica salvo só neste navegador e você pode limpá-lo quando quiser.</p>
  </div>
}
