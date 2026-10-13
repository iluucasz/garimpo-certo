import Image from 'next/image'
import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { buildCollections } from '@/lib/catalog/collections'
import styles from '@/components/editorial/editorial.module.css'

export const revalidate = 300
export const metadata = {
  title: 'Coleções',
  description: 'Seleções montadas a partir do catálogo: mais vendidos, em promoção, bem avaliados e até R$ 50.',
  alternates: { canonical: '/colecoes' },
}

export default async function CollectionsPage() {
  const catalog = await getStoreCatalog()
  const collections = buildCollections(catalog)

  return <StorefrontShell>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><span aria-current="page">Coleções</span></nav>
      <header className={styles.header}>
        <h1>Coleções</h1>
        <p className={styles.lead}>Seleções que se atualizam sozinhas com os preços, as notas e as vendas da Shopee. Cada uma explica o critério que usa.</p>
      </header>
      {collections.length === 0
        ? <p className={styles.empty}>As coleções aparecem quando o catálogo tem produtos suficientes. <Link href="/buscar">Explorar o catálogo</Link></p>
        : <div className={styles.cards}>{collections.map((collection) => <Link href={`/colecoes/${collection.slug}`} className={styles.card} key={collection.slug}>
          <span className={styles.cardText}><small>{collection.tone}</small><strong>{collection.title}</strong><p>{collection.description}</p><span>Ver {collection.products.length} {collection.products.length === 1 ? 'produto' : 'produtos'}</span></span>
          <span className={styles.mosaic} aria-hidden="true">{collection.products.slice(0, 3).map((product) => <span key={product.id}><Image src={product.image} alt="" fill sizes="96px"/></span>)}</span>
        </Link>)}</div>}
    </div>
  </StorefrontShell>
}
