import Image from 'next/image'
import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { getCatalogRules, getGuideChecklists } from '@/lib/catalog/server-rules'
import { buildCollections, collectionGroups, pickCovers } from '@/lib/catalog/collections'
import styles from '@/components/editorial/editorial.module.css'

export const revalidate = 300
export const metadata = {
  title: 'Coleções',
  description: 'Seleções montadas a partir do catálogo: o que viralizou, mais vendidos, achadinhos, promoções e o que está bem avaliado.',
  alternates: { canonical: '/colecoes' },
}

const groupIntro: Record<string, string> = {
  'Em alta': 'O que mais está saindo, medido em vendas recentes informadas pela Shopee.',
  'Preço': 'Para decidir pelo bolso: faixas de preço e quedas reais sobre o preço anterior.',
  'Qualidade': 'Notas altas, com vendas suficientes para a nota significar alguma coisa.',
  'Por categoria': 'O que mais vende dentro de cada categoria.',
  'Curadoria': 'Selecionados à mão pela nossa equipe.',
}

export default async function CollectionsPage() {
  const [catalog, rules] = await Promise.all([getStoreCatalog(), getCatalogRules()])
  const collections = buildCollections({ ...catalog, rules })
  // A ordem de exibição (grupos) define quem ganha cada capa primeiro.
  const ordered = collectionGroups.flatMap((group) => collections.filter((collection) => collection.group === group))
  const covers = pickCovers(ordered)

  return <StorefrontShell>
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><span aria-current="page">Coleções</span></nav>
      <header className={styles.header}>
        <h1>Coleções</h1>
        <p className={styles.lead}>Seleções que se atualizam sozinhas com os preços, as notas e as vendas da Shopee. Cada uma explica o critério que usa.</p>
      </header>
      {collections.length === 0
        ? <p className={styles.empty}>As coleções aparecem quando o catálogo tem produtos suficientes. <Link href="/buscar">Explorar o catálogo</Link></p>
        : collectionGroups.map((group) => {
          const items = collections.filter((collection) => collection.group === group)
          if (!items.length) return null
          const headingId = `grupo-${group.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`
          return <section className={styles.section} aria-labelledby={headingId} key={group}>
            <h2 id={headingId}>{group}</h2>
            <p className={styles.sectionLead}>{groupIntro[group]}</p>
            <div className={styles.cards}>{items.map((collection) => <Link href={`/colecoes/${collection.slug}`} className={styles.card} key={collection.slug}>
              <span className={styles.cardText}><small>{collection.tone}</small><strong>{collection.title}</strong><p>{collection.description}</p><span>Ver {collection.total} {collection.total === 1 ? 'produto' : 'produtos'}</span></span>
              <span className={styles.mosaic} aria-hidden="true">{(covers.get(collection.slug) ?? []).map((product) => <span key={product.id}><Image src={product.image} alt="" fill sizes="96px"/></span>)}</span>
            </Link>)}</div>
          </section>
        })}
    </div>
  </StorefrontShell>
}
