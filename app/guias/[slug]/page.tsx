import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/product/product-card'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { buildGuide, guideSlugs } from '@/lib/catalog/guides'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { getCatalogRules, getGuideChecklists } from '@/lib/catalog/server-rules'
import { formatPrice } from '@/lib/format'
import { siteUrl } from '@/lib/site'
import styles from '@/components/editorial/editorial.module.css'

export const revalidate = 300

export async function generateStaticParams() {
  return guideSlugs(await getStoreCatalog()).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [base, checklists] = await Promise.all([getStoreCatalog(), getGuideChecklists()])
  const guide = buildGuide({ ...base, checklists }, slug)
  if (!guide) notFound()
  const description = `O que conferir antes de comprar em ${guide.category.name.toLocaleLowerCase('pt-BR')}, com ${guide.count} produtos de ${formatPrice(guide.stats.minPrice)} a ${formatPrice(guide.stats.maxPrice)}.`
  return {
    title: guide.title,
    description,
    alternates: { canonical: `/guias/${slug}` },
    openGraph: { title: `${guide.title} · Garimpo certo`, description, url: `${siteUrl}/guias/${slug}` },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [catalog, checklists] = await Promise.all([getStoreCatalog(), getGuideChecklists()])
  const guide = buildGuide({ ...catalog, checklists }, slug)
  if (!guide) notFound()

  const others = guideSlugs(catalog).filter((item) => item !== slug).flatMap((item) => { const found = catalog.categories.find((category) => category.slug === item); return found ? [found] : [] })
  const { stats } = guide

  return <StorefrontShell>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><Link href="/guias">Guias</Link><span aria-hidden="true">/</span><span aria-current="page">{guide.category.name}</span></nav>
      <header className={styles.header}>
        <h1>{guide.title}</h1>
      </header>

      <section className={styles.facts} aria-label="Resumo da categoria">
        <div className={styles.fact}><span>Faixa de preço</span><strong>{formatPrice(stats.minPrice)} a {formatPrice(stats.maxPrice)}</strong><small>Mediana {formatPrice(stats.medianPrice)}</small></div>
        <div className={styles.fact}><span>Nota média</span><strong>{stats.averageRating ? stats.averageRating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</strong><small>entre os produtos com nota</small></div>
        <div className={styles.fact}><span>Mais vendido</span><strong>{stats.topSeller ? `${stats.topSeller.sold.toLocaleString('pt-BR')} vendas` : '—'}</strong>{stats.topSeller && <small><Link href={`/produto/${stats.topSeller.product.slug}`}>{stats.topSeller.product.name.length > 56 ? `${stats.topSeller.product.name.slice(0, 55)}…` : stats.topSeller.product.name}</Link></small>}</div>
      </section>

      {guide.checks.length > 0 && <section className={styles.section} aria-labelledby="o-que-observar">
        <h2 id="o-que-observar">O que observar antes de comprar</h2>
        <ul className={styles.checks}>{guide.checks.map((check) => <li key={check.title}><strong>{check.title}</strong><p>{check.text}</p></li>)}</ul>
      </section>}

      {guide.picks.length > 0 && <section className={styles.section} aria-labelledby="destaques">
        <h2 id="destaques">Destaques de hoje</h2>
        <div className={styles.picks}>{guide.picks.map((pick) => <div className={styles.pick} key={pick.product.id}>
          <span className={styles.pickLabel}><strong>{pick.label}</strong><span>{pick.reason}</span></span>
          <ProductCard product={pick.product}/>
        </div>)}</div>
      </section>}

      <section className={styles.section} aria-labelledby="mais">
        <h2 id="mais">Continue explorando</h2>
        <div className={styles.otherLinks}>
          <Link href={`/categorias/${guide.slug}`}>Todos os produtos de {guide.category.name}</Link>
          {others.map((category) => <Link key={category.slug} href={`/guias/${category.slug}`}>Guia: {category.name}</Link>)}
        </div>
      </section>

    </div>
  </StorefrontShell>
}
