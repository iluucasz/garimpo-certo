'use client'

import { useMemo, useState } from 'react'
import { useVisitorState } from '@/components/visitor-state-provider'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { CategoryRail } from './category-rail'
import { useStoreData } from '@/components/store-data-provider'
import { currentPrice, offerDiscount } from '@/lib/catalog/signals'
import { buildProfile, MIN_SIGNALS, rankForYou } from '@/lib/personalization/affinity'
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
  const { hydrated, cookiePreferences, preferences, preferencesSaved, favorites, recent, compare } = useVisitorState()
  // "Para você" só existe com a personalização permitida e com algo em que se basear: interesses que a pessoa
  // realmente salvou e/ou o que ela viu, favoritou e comparou neste aparelho. Nada disso sai do navegador.
  const interestSlugs = useMemo(() => categories.filter((category) => preferences.categories.includes(category.name)).map((category) => category.slug), [categories, preferences.categories])
  const declared = preferencesSaved ? interestSlugs : []
  const priceOf = useMemo(() => (id: string) => { const product = products.find((item) => item.id === id); return product ? currentPrice(product, offers) : 0 }, [products, offers])
  const interactions = useMemo(() => ({ recent, favorites, compare }), [recent, favorites, compare])
  const profile = useMemo(() => buildProfile(interactions, products.map((item) => ({ id: item.id, category: item.category, brand: item.brand, score: item.score })), priceOf, declared), [interactions, products, priceOf, declared])
  const personalized = useMemo(
    () => rankForYou(products.map((item) => ({ id: item.id, category: item.category, brand: item.brand, score: item.score })), profile, interactions, priceOf),
    [products, profile, interactions, priceOf],
  )
  const hasBehavior = profile.signals >= MIN_SIGNALS
  const forYouAvailable = hydrated && cookiePreferences.personalization && (hasBehavior || declared.length > 0) && personalized.length > 0
  const [requested, setFilter] = useState<FilterId>(activeFilter)
  const filter: FilterId = requested === 'foryou' && !forYouAvailable ? 'trending' : requested
  const sorted = useMemo(() => {
    const sold = (id: string) => getBestOffer(id)?.soldCount ?? 0
    const byFilter = {
      trending: () => [...products].sort((a, b) => sold(b.id) - sold(a.id)),
      discount: () => [...products].sort((a, b) => offerDiscount(getBestOffer(b.id)) - offerDiscount(getBestOffer(a.id))),
      rating: () => [...products].sort((a, b) => b.rating - a.rating || sold(b.id) - sold(a.id)),
      budget: () => products.filter((product) => { const offer = getBestOffer(product.id); return offer && offer.price <= BUDGET }).sort((a, b) => b.score - a.score),
      foryou: () => {
        const order = new Map(personalized.map((item, index) => [item.product.id, index]))
        return products.filter((product) => order.has(product.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
      },
    }
    return byFilter[filter]()
  }, [products, offers, getBestOffer, filter, personalized])
  const shown = sorted.slice(0, PAGE)

  function select(next: FilterId) {
    setFilter(next)
    window.history.replaceState(null, '', next === 'trending' ? '/#ofertas' : `/?filtro=${next}#ofertas`)
  }

  return <>
    <CategoryRail/>

    <section className={`${styles.featured} container`} id="ofertas" aria-labelledby="featured-title">
      <div className={styles.sectionHeading}>
        <div><h2 id="featured-title">Achados para conhecer.</h2><p>Escolha por tendência, desconto ou nota. Os botões de compra levam à Shopee por link de afiliado.</p></div>
        <Link href="/buscar">Ver todos os produtos <ArrowUpRight aria-hidden="true"/></Link>
      </div>
      <div className={styles.filters} role="group" aria-label="Ordenar vitrine principal">{(forYouAvailable ? [forYouFilter, ...filters] : filters).map((item) => <Link key={item.id} href={item.id === 'trending' ? '/#ofertas' : `/?filtro=${item.id}#ofertas`} scroll={false} className={filter === item.id ? styles.activeFilter : ''} aria-current={filter === item.id ? 'true' : undefined} onClick={(event) => { event.preventDefault(); select(item.id) }}>{item.label}</Link>)}</div>
      {filter === 'foryou' && <p className={styles.personalNote}>Selecionado neste aparelho a partir do que você {hasBehavior ? 'viu, favoritou e comparou' : 'escolheu em Minha conta'}. Nada disso é enviado a ninguém. <Link href="/privacidade">Gerenciar privacidade</Link></p>}
      <p className="sr-only" role="status">{shown.length ? `Mostrando ${shown.length} produtos: ${filters.find((item) => item.id === filter)?.label}.` : 'Nenhum produto nesta seleção.'}</p>
      <div>
        {shown.length ? <ProductGrid items={shown}/> : <div className={styles.emptyState}><p><strong>Nada por aqui ainda.</strong> Nenhum produto cabe nesta seleção no momento.</p><Link href="/buscar">Explorar o catálogo <ArrowRight aria-hidden="true"/></Link></div>}
      </div>
      {sorted.length > PAGE && <div className={styles.moreRow}><Link className={styles.moreButton} href="/buscar">Ver os {products.length} produtos do catálogo <ArrowRight aria-hidden="true"/></Link></div>}
      <p className={styles.disclosure}>Links patrocinados: podemos receber comissão da Shopee pelas compras feitas por eles.</p>
    </section>
  </>
}
