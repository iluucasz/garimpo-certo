'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingDown } from 'lucide-react'
import { formatPrice } from '@/lib/format'
import { useVisitorState } from '@/components/visitor-state-provider'
import { useStoreData } from '@/components/store-data-provider'
import { ProductGrid } from '@/components/product/product-card'
import { ContentSkeleton } from './store-loading'
import { EmptyCollection, PersonalHeading, SuggestedProducts } from './personal-page-parts'
import styles from './personal-pages.module.css'

export function FavoritesCollection() {
  const { favorites, hydrated, priceDrops } = useVisitorState()
  const { products, getBestOffer } = useStoreData()
  const [sort, setSort] = useState('saved')
  if (!hydrated) return <ContentSkeleton/>
  const dropped = priceDrops.flatMap((drop) => { const product = products.find((item) => item.id === drop.productId); return product ? [{ drop, product }] : [] })
  const items = favorites.flatMap((id) => { const product = products.find((item) => item.id === id); return product ? [product] : [] })
  if (sort === 'price') items.sort((a, b) => (getBestOffer(a.id)?.price ?? Infinity) - (getBestOffer(b.id)?.price ?? Infinity))
  if (sort === 'rating') items.sort((a, b) => b.rating - a.rating)

  return <div className={`container ${styles.page}`}><PersonalHeading mode="favorites"/>
    {dropped.length > 0 && <section className={styles.drops} aria-labelledby="price-drops-title">
      <h2 id="price-drops-title"><TrendingDown aria-hidden="true"/>{dropped.length === 1 ? '1 favorito ficou mais barato' : `${dropped.length} favoritos ficaram mais baratos`}</h2>
      <ul>{dropped.map(({ drop, product }) => <li key={drop.productId}>
        <Link href={`/produto/${product.slug}`}>{product.name}</Link>
        <span><s>{formatPrice(drop.from)}</s> <strong>{formatPrice(drop.to)}</strong> · menos {formatPrice(drop.amount)} ({drop.percent}%)</span>
      </li>)}</ul>
    </section>}
    {items.length ? <><div className={styles.toolbar}><p><strong>{items.length}</strong> {items.length === 1 ? 'produto na sua seleção' : 'produtos na sua seleção'}</p><label>Ordenar por<select aria-label="Ordenar favoritos" value={sort} onChange={(event) => setSort(event.target.value)}><option value="saved">Salvos recentemente</option><option value="price">Menor preço</option><option value="rating">Melhor avaliados</option></select></label></div><section aria-labelledby="saved-products-title"><h2 id="saved-products-title" className="sr-only">Produtos favoritos</h2><ProductGrid items={items}/></section></> : <><EmptyCollection mode="favorites"/><SuggestedProducts mode="favorites"/></>}
  </div>
}
