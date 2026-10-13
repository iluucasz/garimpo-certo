import Image from 'next/image'
import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { buildGuide, guideSlugs } from '@/lib/catalog/guides'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { getCatalogRules, getGuideChecklists } from '@/lib/catalog/server-rules'
import { formatPrice } from '@/lib/format'
import styles from '@/components/editorial/editorial.module.css'

export const revalidate = 300
export const metadata = {
  title: 'Guias de compra',
  description: 'O que observar antes de comprar em cada categoria, com os destaques atuais do catálogo.',
  alternates: { canonical: '/guias' },
}

export default async function GuidesPage() {
  const [base, checklists] = await Promise.all([getStoreCatalog(), getGuideChecklists()])
  const catalog = { ...base, checklists }
  const guides = guideSlugs(catalog).flatMap((slug) => { const guide = buildGuide(catalog, slug); return guide ? [guide] : [] })

  return <StorefrontShell>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><span aria-current="page">Guias de compra</span></nav>
      <header className={styles.header}>
        <h1>Guias de compra</h1>
        <p className={styles.lead}>Para cada categoria: o que vale conferir antes de comprar e quais produtos se destacam hoje em vendas, nota e preço.</p>
      </header>
      {guides.length === 0
        ? <p className={styles.empty}>Os guias aparecem quando uma categoria tem produtos suficientes. <Link href="/buscar">Explorar o catálogo</Link></p>
        : <div className={styles.cards}>{guides.map((guide) => {
          const covers = guide.picks.slice(0, 3)
          return <Link href={`/guias/${guide.slug}`} className={styles.card} key={guide.slug}>
            <span className={styles.cardText}><small>{guide.count} produtos</small><strong>{guide.category.name}</strong><p>Preços de {formatPrice(guide.stats.minPrice)} a {formatPrice(guide.stats.maxPrice)} e {guide.checks.length} pontos para conferir antes de decidir.</p><span>Abrir o guia</span></span>
            <span className={styles.mosaic} aria-hidden="true">{covers.map((pick) => <span key={pick.product.id}><Image src={pick.product.image} alt="" fill sizes="96px"/></span>)}</span>
          </Link>
        })}</div>}
    </div>
  </StorefrontShell>
}
