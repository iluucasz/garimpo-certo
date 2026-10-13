import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { buildCollections } from '@/lib/catalog/collections'
import { getCatalogRules } from '@/lib/catalog/server-rules'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import type { Section } from '@/lib/site-builder/document'
import styles from './cms-blocks.module.css'

const SHOWN = 8

/** Bloco "Produtos de uma coleção": os primeiros itens da coleção escolhida, com dado real do catálogo. */
export async function CollectionBlock({ section }: { section: Section }) {
  const { settings: s } = section
  if (!s.collection) return null
  const [catalog, rules] = await Promise.all([getStoreCatalog(), getCatalogRules()])
  const collection = buildCollections({ ...catalog, rules }).find((item) => item.slug === s.collection)
  // Coleção que deixou de existir (regra mudou, produtos saíram): o bloco some em vez de mostrar uma lista vazia.
  if (!collection || collection.products.length === 0) return null
  return <section className={`container ${styles.collection}`} aria-label={s.title || collection.title}>
    <header>
      <h2>{s.title || collection.title}</h2>
      {(s.text || collection.description) && <p>{s.text || collection.description}</p>}
    </header>
    <ProductGrid items={collection.products.slice(0, SHOWN)} eagerCount={0}/>
    <Link className={styles.collectionLink} href={`/colecoes/${collection.slug}`}>{s.buttonLabel || 'Ver a coleção completa'} <ArrowRight aria-hidden="true"/></Link>
  </section>
}
