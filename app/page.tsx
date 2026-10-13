import { Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BadgeCheck, ExternalLink, RefreshCw } from 'lucide-react'
import { CampaignBanner } from '@/components/home/campaign-banner'
import { HomeCatalog } from '@/components/home/home-catalog'
import { HomeSelections } from '@/components/home/home-selections'
import { HeroStat } from '@/components/home/hero-stat'
import { FeaturedProducts } from '@/components/home/featured-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { buildGuide, guideSlugs } from '@/lib/catalog/guides'
import { getActiveCampaigns } from '@/lib/db/repositories/site-content'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { getSetting } from '@/lib/settings'
import { formatPrice } from '@/lib/format'
import { siteUrl } from '@/lib/site'
import styles from '@/components/home/home.module.css'

const validFilters = ['trending', 'discount', 'rating', 'budget', 'foryou'] as const
type HomeFilter = (typeof validFilters)[number]

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Garimpo certo',
  url: siteUrl,
  inLanguage: 'pt-BR',
  potentialAction: { '@type': 'SearchAction', target: `${siteUrl}/buscar?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
}

export default async function Home({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const params = await searchParams
  const activeFilter = validFilters.includes(params.filtro as HomeFilter) ? params.filtro as HomeFilter : 'trending'
  const [catalog, home, campaigns] = await Promise.all([getStoreCatalog(), getSetting('home'), getActiveCampaigns()])
  const visible = (id: string) => home[`show_${id}`] !== false
  const order = (Array.isArray(home.sectionOrder) ? home.sectionOrder : []).map(String).filter(visible)
  const guides = guideSlugs(catalog).flatMap((slug) => { const guide = buildGuide(catalog, slug); return guide ? [guide] : [] }).slice(0, 3)

  const sections: Record<string, React.ReactNode> = {
    catalog: <HomeCatalog activeFilter={activeFilter}/>,
    selections: <HomeSelections/>,
    guides: guides.length > 0 ? <section className={styles.guides} aria-labelledby="guides-title"><div className={`container ${styles.guidesInner}`}>
      <div className={styles.guideIntro}><h2 id="guides-title">Antes de comprar.</h2><p>O que conferir em cada categoria, com os destaques de hoje do catálogo.</p><Link href="/guias">Todos os guias <ArrowRight aria-hidden="true"/></Link></div>
      <div className={styles.guideList}>{guides.map((guide) => <Link href={`/guias/${guide.slug}`} className={styles.guide} key={guide.slug}>
        <div className={styles.guideImage}>{guide.picks[0] && <Image src={guide.picks[0].product.image} alt="" fill sizes="(max-width: 700px) 88px, 140px"/>}</div>
        <div><span>{guide.count} produtos <i/> de {formatPrice(guide.stats.minPrice)} a {formatPrice(guide.stats.maxPrice)}</span><h3>{guide.title}</h3></div><ArrowUpRight aria-hidden="true"/>
      </Link>)}</div>
    </div></section> : null,
    howItWorks: <section className={`${styles.howItWorks} container`} aria-labelledby="how-title">
      <h2 id="how-title">Você escolhe.<br/>A gente ajuda a encontrar.</h2>
      <div><p>Compare ofertas, salve seus favoritos e finalize a compra na loja parceira. Podemos receber uma comissão pelos links de afiliados.</p><Link href="/como-funciona">Como o Garimpo funciona <ArrowUpRight aria-hidden="true"/></Link></div>
    </section>,
  }

  return <StorefrontShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}/>
    <div className={styles.home}>
      <section className={`${styles.hero} container`} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <HeroStat/>
          <h1 id="home-title">{String(home.heroTitle)} <span>{String(home.heroAccent)}</span></h1>
          <p className={styles.heroLead}>{String(home.heroLead)}</p>
          <div className={styles.heroActions}>
            <Link className={styles.heroButton} href={visible('catalog') ? '#ofertas' : '/buscar'}>{String(home.ctaLabel)} <ArrowRight aria-hidden="true"/></Link>
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

      <CampaignBanner campaigns={campaigns}/>

      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
    </div>
  </StorefrontShell>
}
