import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { HomeCatalog } from '@/components/home/home-catalog'
import { FeaturedProducts } from '@/components/home/featured-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { articles, collections, products } from '@/lib/mock-data'
import styles from '@/components/home/home.module.css'

const validFilters = ['trending', 'discount', 'rating', 'budget'] as const
type HomeFilter = (typeof validFilters)[number]
const collectionImages = [products[4].image, products[12].image, products[7].image]

export default async function Home({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const params = await searchParams
  const activeFilter = validFilters.includes(params.filtro as HomeFilter) ? params.filtro as HomeFilter : 'trending'

  return <StorefrontShell>
    <div className={styles.home}>
      <section className={`${styles.hero} container`} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>ENCONTRE. COMPARE. APROVEITE.</span>
          <h1 id="home-title">Bons produtos.<br/><em>Preços que valem.</em></h1>
          <p>Encontre seu próximo achado e compre direto na loja com a melhor oferta disponível.</p>
          <Link className={styles.heroButton} href="#ofertas">Ver ofertas <ArrowRight aria-hidden="true"/></Link>
          <div className={styles.heroFootnote}><span>Casa, tecnologia e muito mais</span><ArrowDown aria-hidden="true"/></div>
        </div>
        <FeaturedProducts/>
      </section>

      <HomeCatalog activeFilter={activeFilter}/>

      <section className={`${styles.collections} container`} id="colecoes" aria-labelledby="collections-title">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SELEÇÕES GARIMPO</span><h2 id="collections-title">Um ponto de partida.</h2></div><p>Reunimos algumas ideias para você explorar.</p></div>
        <div className={styles.collectionGrid}>{collections.map((collection, index) => <Link href={`/colecoes/${collection.slug}`} className={styles.collection} key={collection.id}>
          <div className={styles.collectionImage}><Image src={collectionImages[index]} alt="" fill sizes="(max-width: 700px) 90vw, 33vw"/><span>0{index + 1}</span></div>
          <div className={styles.collectionCaption}><div><span>{collection.tone}</span><h3>{collection.title}</h3></div><ArrowUpRight aria-hidden="true"/></div>
        </Link>)}</div>
      </section>

      <section className={styles.guides} aria-labelledby="guides-title"><div className={`container ${styles.guidesInner}`}>
        <div className={styles.guideIntro}><span className={styles.eyebrow}>ANTES DE ESCOLHER</span><h2 id="guides-title">Vale a<br/> <em>leitura.</em></h2><p>Detalhes que ajudam a decidir qual produto combina com você.</p><Link href="/guias">Todos os guias <ArrowRight aria-hidden="true"/></Link></div>
        <div className={styles.guideList}>{articles.map((article) => <Link href={`/guias/${article.slug}`} className={styles.guide} key={article.id}>
          <div className={styles.guideImage}><Image src={article.image} alt="" fill sizes="(max-width: 700px) 100px, 140px"/></div><div><span>{article.category} <i/> {article.readTime} de leitura</span><h3>{article.title}</h3></div><ArrowUpRight aria-hidden="true"/>
        </Link>)}</div>
      </div></section>

      <section className={`${styles.howItWorks} container`} aria-labelledby="how-title">
        <h2 id="how-title">Você escolhe.<br/>A gente ajuda a encontrar.</h2>
        <div><p>Compare ofertas, salve seus favoritos e finalize a compra na loja parceira. Podemos receber uma comissão pelos links de afiliados.</p><Link href="/como-funciona">Como o Garimpo funciona <ArrowUpRight aria-hidden="true"/></Link></div>
      </section>
    </div>
  </StorefrontShell>
}
