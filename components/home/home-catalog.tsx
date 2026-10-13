'use client'

import { useMemo, useState } from 'react'
import { useVisitorState } from '@/components/visitor-state-provider'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { useStoreData } from '@/components/store-data-provider'
import { currentPrice, offerDiscount } from '@/lib/catalog/signals'
import styles from './home.module.css'

const filters = [
  { id: 'trending', label: 'Em alta' },
  { id: 'discount', label: 'Maior desconto' },
  { id: 'rating', label: 'Melhor avaliados' },
  { id: 'budget', label: 'Até R$ 50' },
] as const
const forYouFilter = { id: 'foryou', label: 'Para você' } as const
type FilterId = (typeof filters)[number]['id'] | 'foryou'
const BUDGET = 50
const PAGE = 8

export function HomeCatalog({ activeFilter = 'trending' }: { activeFilter?: FilterId }) {
  const { products, categories, offers, getBestOffer } = useStoreData()
  const { hydrated, cookiePreferences, preferences, preferencesSaved } = useVisitorState()
  // "Para você" só existe com a personalização permitida e interesses que a pessoa realmente salvou.
  const interestSlugs = useMemo(() => categories.filter((category) => preferences.categories.includes(category.name)).map((category) => category.slug), [categories, preferences.categories])
  const forYouAvailable = hydrated && cookiePreferences.personalization && preferencesSaved && interestSlugs.length > 0
  const [requested, setFilter] = useState<FilterId>(activeFilter)
  const filter: FilterId = requested === 'foryou' && !forYouAvailable ? 'trending' : requested
  const sorted = useMemo(() => {
    const sold = (id: string) => getBestOffer(id)?.soldCount ?? 0
    const byFilter = {
      trending: () => [...products].sort((a, b) => sold(b.id) - sold(a.id)),
      discount: () => [...products].sort((a, b) => offerDiscount(getBestOffer(b.id)) - offerDiscount(getBestOffer(a.id))),
      rating: () => [...products].sort((a, b) => b.rating - a.rating || sold(b.id) - sold(a.id)),
      budget: () => products.filter((product) => { const offer = getBestOffer(product.id); return offer && offer.price <= BUDGET }).sort((a, b) => b.score - a.score),
      foryou: () => products.filter((product) => interestSlugs.includes(product.category) && currentPrice(product, offers) <= preferences.maxPrice).sort((a, b) => b.score - a.score),
    }
    return byFilter[filter]()
  }, [products, offers, getBestOffer, filter, interestSlugs, preferences.maxPrice])
  const shown = sorted.slice(0, PAGE)

  function select(next: FilterId) {
    setFilter(next)
    window.history.replaceState(null, '', next === 'trending' ? '/#ofertas' : `/?filtro=${next}#ofertas`)
  }

  return <>
    <section className={`${styles.categories} container`} id="categorias" aria-labelledby="home-categories-title">
      <div className={styles.categoryIntro}><h2 id="home-categories-title">Por onde começamos?</h2><Link href="/buscar">Todo o catálogo <ArrowRight aria-hidden="true"/></Link></div>
      <div className={styles.categoryList}>{categories.map((category) => {
        const items = products.filter((product) => product.category === category.slug)
        return <Link href={`/categorias/${category.slug}`} className={styles.category} key={category.id}>
          <span className={styles.categoryImage}><Image src={items[0]?.image ?? '/placeholder.jpg'} alt="" fill sizes="48px"/></span>
          <span className={styles.categoryText}><strong>{category.name}</strong><span>{items.length} {items.length === 1 ? 'produto' : 'produtos'}</span></span>
        </Link>
      })}</div>
    </section>

    <section className={`${styles.featured} container`} id="ofertas" aria-labelledby="featured-title">
      <div className={styles.sectionHeading}>
        <div><h2 id="featured-title">Achados para conhecer.</h2><p>Escolha por tendência, desconto ou nota. Os botões de compra levam à Shopee por link de afiliado.</p></div>
        <Link href="/buscar">Ver todos os produtos <ArrowUpRight aria-hidden="true"/></Link>
      </div>
      <div className={styles.filters} role="group" aria-label="Ordenar vitrine principal">{(forYouAvailable ? [forYouFilter, ...filters] : filters).map((item) => <Link key={item.id} href={item.id === 'trending' ? '/#ofertas' : `/?filtro=${item.id}#ofertas`} scroll={false} className={filter === item.id ? styles.activeFilter : ''} aria-current={filter === item.id ? 'true' : undefined} onClick={(event) => { event.preventDefault(); select(item.id) }}>{item.label}</Link>)}</div>
      <p className="sr-only" role="status">{shown.length ? `Mostrando ${shown.length} produtos: ${filters.find((item) => item.id === filter)?.label}.` : 'Nenhum produto nesta seleção.'}</p>
      <div>
        {shown.length ? <ProductGrid items={shown}/> : <div className={styles.emptyState}><p><strong>Nada por aqui ainda.</strong> Nenhum produto cabe nesta seleção no momento.</p><Link href="/buscar">Explorar o catálogo <ArrowRight aria-hidden="true"/></Link></div>}
      </div>
      {sorted.length > PAGE && <div className={styles.moreRow}><Link className={styles.moreButton} href="/buscar">Ver os {products.length} produtos do catálogo <ArrowRight aria-hidden="true"/></Link></div>}
      <p className={styles.disclosure}>Links patrocinados: podemos receber comissão da Shopee pelas compras feitas por eles.</p>
    </section>
  </>
}
