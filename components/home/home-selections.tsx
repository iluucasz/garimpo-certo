'use client'

import Link from 'next/link'
import { ArrowUpRight, BadgePercent, Flame, Heart, Star, Wallet, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useStoreData } from '@/components/store-data-provider'
import { buildCollections } from '@/lib/catalog/collections'
import styles from './home.module.css'

/** Quais coleções vão para a home, em ordem, e o ícone de cada uma. Só aparecem as que existem no catálogo. */
const featured: { slug: string; icon: LucideIcon }[] = [
  { slug: 'viralizou', icon: Flame },
  { slug: 'achadinhos', icon: Wallet },
  { slug: 'em-promocao', icon: BadgePercent },
  { slug: 'queridinhos', icon: Heart },
  { slug: 'bem-avaliados', icon: Star },
  { slug: 'mais-vendidos', icon: Flame },
]

export function HomeSelections() {
  const { products, offers, categories } = useStoreData()
  const tiles = useMemo(() => {
    const collections = buildCollections({ products, offers, categories })
    return featured.flatMap(({ slug, icon }) => {
      const collection = collections.find((item) => item.slug === slug)
      return collection ? [{ collection, icon }] : []
    }).slice(0, 4)
  }, [products, offers, categories])
  if (!tiles.length) return null

  return <section className={`${styles.selections} container`} id="selecoes" aria-labelledby="selections-title">
    <div className={styles.sectionHeading}><div><h2 id="selections-title">Escolha pelo que importa.</h2><p>Seleções que se atualizam sozinhas com os dados da Shopee.</p></div><Link href="/colecoes">Todas as coleções <ArrowUpRight aria-hidden="true"/></Link></div>
    <div className={styles.selectionGrid}>{tiles.map(({ collection, icon: Icon }) => <Link href={`/colecoes/${collection.slug}`} className={styles.selection} key={collection.slug}>
      <span className={styles.selectionIcon} aria-hidden="true"><Icon/></span>
      <span className={styles.selectionText}><strong>{collection.title}</strong><span>{collection.tone}</span><small>{collection.total} {collection.total === 1 ? 'produto' : 'produtos'}</small></span>
      <ArrowUpRight aria-hidden="true"/>
    </Link>)}</div>
  </section>
}
