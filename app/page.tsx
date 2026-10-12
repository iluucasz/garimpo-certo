import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BadgeCheck, ExternalLink, RefreshCw } from 'lucide-react'
import { HomeCatalog } from '@/components/home/home-catalog'
import { HomeSelections } from '@/components/home/home-selections'
import { HeroStat } from '@/components/home/hero-stat'
import { FeaturedProducts } from '@/components/home/featured-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { articles } from '@/lib/mock-data'
import styles from '@/components/home/home.module.css'

const validFilters = ['trending', 'discount', 'rating', 'budget'] as const
type HomeFilter = (typeof validFilters)[number]

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Garimpo certo',
  url: 'https://garimpo.example',
  inLanguage: 'pt-BR',
  potentialAction: { '@type': 'SearchAction', target: 'https://garimpo.example/buscar?q={search_term_string}', 'query-input': 'required name=search_term_string' },
}

export default async function Home({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const params = await searchParams
  const activeFilter = validFilters.includes(params.filtro as HomeFilter) ? params.filtro as HomeFilter : 'trending'

  return <StorefrontShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}/>
    <div className={styles.home}>
      <section className={`${styles.hero} container`} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <HeroStat/>
          <h1 id="home-title">Bons produtos. <span>Preços que valem.</span></h1>
          <p className={styles.heroLead}>Encontre seu próximo achado e compre direto na loja com a melhor oferta disponível.</p>
          <div className={styles.heroActions}>
            <Link className={styles.heroButton} href="#ofertas">Ver ofertas <ArrowRight aria-hidden="true"/></Link>
            <Link className={styles.heroLink} href="/como-funciona">Como funciona</Link>
          </div>
          <ul className={styles.trust} aria-label="Como o Garimpo trabalha">
            <li><ExternalLink aria-hidden="true"/>Você compra na Shopee, não aqui</li>
            <li><RefreshCw aria-hidden="true"/>Preços e vendas da última sincronização</li>
            <li><BadgeCheck aria-hidden="true"/>Links de afiliado sempre sinalizados</li>
          </ul>
        </div>
        <FeaturedProducts/>
      </section>

      <HomeCatalog activeFilter={activeFilter}/>
      <HomeSelections/>

      <section className={styles.guides} aria-labelledby="guides-title"><div className={`container ${styles.guidesInner}`}>
        <div className={styles.guideIntro}><h2 id="guides-title">Vale a leitura.</h2><p>Detalhes que ajudam a decidir qual produto combina com você.</p><Link href="/guias">Todos os guias <ArrowRight aria-hidden="true"/></Link></div>
        <div className={styles.guideList}>{articles.map((article) => <Link href={`/guias/${article.slug}`} className={styles.guide} key={article.id}>
          <div className={styles.guideImage}><Image src={article.image} alt="" fill sizes="(max-width: 700px) 88px, 140px"/></div><div><span>{article.category} <i/> {article.readTime} de leitura</span><h3>{article.title}</h3></div><ArrowUpRight aria-hidden="true"/>
        </Link>)}</div>
      </div></section>

      <section className={`${styles.howItWorks} container`} aria-labelledby="how-title">
        <h2 id="how-title">Você escolhe.<br/>A gente ajuda a encontrar.</h2>
        <div><p>Compare ofertas, salve seus favoritos e finalize a compra na loja parceira. Podemos receber uma comissão pelos links de afiliados.</p><Link href="/como-funciona">Como o Garimpo funciona <ArrowUpRight aria-hidden="true"/></Link></div>
      </section>
    </div>
  </StorefrontShell>
}
