import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductGrid } from '@/components/product/product-card'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { buildCollections, collectionSlugsFor } from '@/lib/catalog/collections'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { siteUrl } from '@/lib/site'
import styles from '@/components/editorial/editorial.module.css'

export const revalidate = 300

export async function generateStaticParams() {
  return collectionSlugsFor(await getStoreCatalog()).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const collection = buildCollections(await getStoreCatalog()).find((item) => item.slug === slug)
  if (!collection) notFound()
  return {
    title: collection.title,
    description: collection.description,
    alternates: { canonical: `/colecoes/${slug}` },
    openGraph: { title: `${collection.title} · Garimpo certo`, description: collection.description, url: `${siteUrl}/colecoes/${slug}` },
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const catalog = await getStoreCatalog()
  const collections = buildCollections(catalog)
  const collection = collections.find((item) => item.slug === slug)
  if (!collection) notFound()

  // Sugestões: primeiro as do mesmo grupo, depois o resto, no máximo 8.
  const others = [...collections.filter((item) => item.slug !== slug && item.group === collection.group), ...collections.filter((item) => item.slug !== slug && item.group !== collection.group)].slice(0, 8)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: collection.title,
    itemListElement: collection.products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/produto/${product.slug}`, name: product.name })),
  }
  const syncedLabel = catalog.syncedAt
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(catalog.syncedAt))
    : null

  return <StorefrontShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}/>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><Link href="/colecoes">Coleções</Link><span aria-hidden="true">/</span><span aria-current="page">{collection.title}</span></nav>
      <header className={styles.header}>
        <p className={styles.tone}>{collection.tone}</p>
        <h1>{collection.title}</h1>
        <p className={styles.lead}>{collection.description}</p>
        {syncedLabel && <p className={styles.meta}>Preços e vendas da Shopee atualizados em {syncedLabel}.</p>}
      </header>

      <ProductGrid items={collection.products} eagerCount={4}/>

      {others.length > 0 && <section className={styles.section} aria-labelledby="outras-colecoes">
        <h2 id="outras-colecoes">Outras seleções</h2>
        <div className={styles.otherLinks}>{others.map((item) => <Link key={item.slug} href={`/colecoes/${item.slug}`}>{item.title}</Link>)}</div>
      </section>}

      <p className={styles.note}>Os botões de compra levam à Shopee por links de afiliado; podemos receber comissão pelas compras feitas por eles. Preços e estoque podem mudar na loja. <Link href="/como-funciona#afiliados">Como funciona</Link>.</p>
    </div>
  </StorefrontShell>
}
