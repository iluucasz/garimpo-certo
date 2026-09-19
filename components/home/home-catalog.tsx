'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { useStoreData } from '@/components/store-data-provider'
import styles from './home.module.css'

const filters = [
  { id: 'trending', label: 'Em alta' },
  { id: 'discount', label: 'Maior desconto' },
  { id: 'rating', label: 'Melhor avaliados' },
  { id: 'budget', label: 'Até R$ 300' },
] as const
type FilterId = (typeof filters)[number]['id']

export function HomeCatalog({ activeFilter = 'trending' }: { activeFilter?: FilterId }) {
  const { products, categories, getBestOffer } = useStoreData()
  const discount = (id: string) => {
    const offer = getBestOffer(id)
    return offer?.previousPrice && offer.previousPrice > offer.price ? (1 - offer.price / offer.previousPrice) : 0
  }
  const sorted = {
    trending: [...products].sort((a, b) => (getBestOffer(b.id)?.soldCount ?? 0) - (getBestOffer(a.id)?.soldCount ?? 0)),
    discount: [...products].sort((a, b) => discount(b.id) - discount(a.id)),
    rating: [...products].sort((a, b) => b.rating - a.rating || (getBestOffer(b.id)?.soldCount ?? 0) - (getBestOffer(a.id)?.soldCount ?? 0)),
    budget: products.filter((product) => { const offer = getBestOffer(product.id); return offer && offer.price <= 300 }).sort((a, b) => b.score - a.score),
  }[activeFilter]

  return <>
    <section className={`${styles.categories} container`} id="categorias" aria-labelledby="home-categories-title">
      <div className={styles.categoryIntro}><h2 id="home-categories-title">Por onde<br/> começamos?</h2><Link href="/buscar">Todo o catálogo <ArrowRight aria-hidden="true"/></Link></div>
      <div className={styles.categoryList}>{categories.map((category) => {
        const items = products.filter((product) => product.category === category.slug)
        return <Link href={`/categorias/${category.slug}`} className={styles.category} key={category.id}>
          <div className={styles.categoryImage}><Image src={items[0]?.image ?? '/placeholder.jpg'} alt="" fill sizes="100px"/></div>
          <strong>{category.name}</strong><span>{items.length} {items.length === 1 ? 'produto' : 'produtos'}</span>
        </Link>
      })}</div>
    </section>

    <section className={`${styles.featured} container`} id="ofertas" aria-labelledby="featured-title">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>NO NOSSO RADAR</span><h2 id="featured-title">Achados para conhecer.</h2></div><Link href="/buscar">Ver todos os produtos <ArrowUpRight aria-hidden="true"/></Link></div>
      <nav className={styles.filters} aria-label="Filtrar vitrine principal">{filters.map((filter) => <Link key={filter.id} href={`/?filtro=${filter.id}#ofertas`} className={activeFilter === filter.id ? styles.activeFilter : ''} aria-current={activeFilter === filter.id ? 'true' : undefined}>{filter.label}</Link>)}</nav>
      {sorted.length ? <ProductGrid items={sorted.slice(0, 8)}/> : <div className={styles.emptyState}><p>Nenhum produto nesta seleção por enquanto.</p><Link href="/buscar">Explorar o catálogo <ArrowRight aria-hidden="true"/></Link></div>}
    </section>
  </>
}
