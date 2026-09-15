'use client'

import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { ProductGrid } from '@/components/product/product-card'
import { ContentSkeleton } from './store-loading'
import { EmptyCollection, PersonalHeading, SuggestedProducts } from './personal-page-parts'
import styles from './personal-pages.module.css'

export function FavoritesCollection() {
  const { favorites, hydrated } = useMock()
  const { products, getBestOffer } = useStoreData()
  const [sort, setSort] = useState('saved')
  if (!hydrated) return <ContentSkeleton/>
  const items = favorites.flatMap((id) => { const product = products.find((item) => item.id === id); return product ? [product] : [] })
  if (sort === 'price') items.sort((a, b) => (getBestOffer(a.id)?.price ?? Infinity) - (getBestOffer(b.id)?.price ?? Infinity))
  if (sort === 'rating') items.sort((a, b) => b.rating - a.rating)

  return <div className={`container ${styles.page}`}><PersonalHeading mode="favorites"/>
    {items.length ? <><div className={styles.toolbar}><p><strong>{items.length}</strong> {items.length === 1 ? 'produto na sua seleção' : 'produtos na sua seleção'}</p><label>Ordenar por<select aria-label="Ordenar favoritos" value={sort} onChange={(event) => setSort(event.target.value)}><option value="saved">Salvos recentemente</option><option value="price">Menor preço</option><option value="rating">Melhor avaliados</option></select></label></div><section aria-labelledby="saved-products-title"><h2 id="saved-products-title" className="sr-only">Produtos favoritos</h2><ProductGrid items={items}/></section></> : <><EmptyCollection mode="favorites"/><SuggestedProducts mode="favorites"/></>}
    <p className={styles.localNote}><LockKeyhole aria-hidden="true"/>Sem conta, seus favoritos ficam salvos neste navegador.</p>
  </div>
}
