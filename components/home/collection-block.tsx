import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { buildCollections } from '@/lib/catalog/collections'
import { getCatalogRules } from '@/lib/catalog/server-rules'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import type { Section } from '@/lib/site-builder/document'
import styles from './cms-blocks.module.css'

const DEFAULT_SHOWN = 8

/**
 * Bloco "Produtos de uma coleção": os primeiros itens da coleção escolhida, com dado real do catálogo.
 * `productIds` vem da página (home): a escolha já descontou o que aparece em outros blocos.
 */
export async function CollectionBlock({ section, productIds }: { section: Section; productIds?: string[] }) {
  const { settings: s } = section
  if (!s.collection) return null
  const [catalog, rules] = await Promise.all([getStoreCatalog(), getCatalogRules()])
  const collection = buildCollections({ ...catalog, rules }).find((item) => item.slug === s.collection)
  // Coleção que deixou de existir (regra mudou, produtos saíram): o bloco some em vez de mostrar uma lista vazia.
  if (!collection || collection.products.length === 0) return null
  const byId = new Map(collection.products.map((product) => [product.id, product]))
  const items = productIds ? productIds.flatMap((id) => { const product = byId.get(id); return product ? [product] : [] }) : collection.products.slice(0, s.count ?? DEFAULT_SHOWN)
  if (items.length === 0) return null
  const title = s.title || collection.title
  const text = s.text || collection.description
  return <section className={`container ${styles.collection}`} aria-label={title}>
    <header>
      <div><h2>{title}</h2>{text && <p>{text}</p>}</div>
      <Link className={styles.collectionLink} href={`/colecoes/${collection.slug}`}>{s.buttonLabel || 'Ver a coleção completa'} <ArrowUpRight aria-hidden="true"/></Link>
    </header>
    <ProductGrid items={items} eagerCount={0}/>
  </section>
}
