import { Fragment } from 'react'
import { headers } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BadgeCheck, ExternalLink, RefreshCw } from 'lucide-react'
import { CampaignBanner } from '@/components/home/campaign-banner'
import { CmsBlock } from '@/components/home/cms-blocks'
import { HomeCatalog } from '@/components/home/home-catalog'
import { HomeSelections } from '@/components/home/home-selections'
import { HeroStat } from '@/components/home/hero-stat'
import { FeaturedProducts } from '@/components/home/featured-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { auth } from '@/lib/auth/auth'
import { userHasPermission } from '@/lib/auth/permissions'
import { buildGuide, guideSlugs } from '@/lib/catalog/guides'
import { getCatalogRules, getGuideChecklists } from '@/lib/catalog/server-rules'
import { getActiveCampaigns } from '@/lib/db/repositories/site-content'
import { getRenderDocument } from '@/lib/db/repositories/site-documents'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
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

/** `?preview=1` mostra o rascunho do editor, só para quem pode editar conteúdo; para os demais é ignorado. */
async function canPreview() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return Boolean(session && await userHasPermission(session.user.id, 'content:write'))
  } catch {
    return false
  }
}

/** Quebra de linha digitada no editor vira <br/> (o título da seção "Como funciona" usa duas linhas). */
const withBreaks = (text: string) => text.split('\n').map((line, index, all) => <Fragment key={index}>{line}{index < all.length - 1 && <br/>}</Fragment>)

export default async function Home({ searchParams }: { searchParams: Promise<{ filtro?: string; preview?: string }> }) {
  const params = await searchParams
  const activeFilter = validFilters.includes(params.filtro as HomeFilter) ? params.filtro as HomeFilter : 'trending'
  const preview = params.preview === '1' && await canPreview()
  const [baseCatalog, campaigns, checklists, document] = await Promise.all([getStoreCatalog(), getActiveCampaigns(), getGuideChecklists(), getRenderDocument('home', { preview })])
  const catalog = { ...baseCatalog, checklists }
  const guides = guideSlugs(catalog).flatMap((slug) => { const guide = buildGuide(catalog, slug); return guide ? [guide] : [] }).slice(0, 3)
  const sections = document.sections.filter((section) => !section.hidden)
  const hasCatalog = sections.some((section) => section.type === 'catalog')

  function render(section: (typeof sections)[number]) {
    const s = section.settings
    switch (section.type) {
      case 'hero':
        return <section className={`${styles.hero} container`} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <HeroStat/>
            <h1 id="home-title">{s.title} <span>{s.accent}</span></h1>
            <p className={styles.heroLead}>{s.text}</p>
            <div className={styles.heroActions}>
              <Link className={styles.heroButton} href={hasCatalog ? '#ofertas' : '/buscar'}>{s.buttonLabel} <ArrowRight aria-hidden="true"/></Link>
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
      case 'campaign':
        return <CampaignBanner campaigns={campaigns}/>
      case 'catalog':
        return <HomeCatalog activeFilter={activeFilter}/>
      case 'selections':
        return <HomeSelections/>
      case 'guides':
        return guides.length > 0 ? <section className={styles.guides} aria-labelledby="guides-title"><div className={`container ${styles.guidesInner}`}>
          <div className={styles.guideIntro}><h2 id="guides-title">{s.title}</h2><p>{s.text}</p><Link href="/guias">{s.buttonLabel} <ArrowRight aria-hidden="true"/></Link></div>
          <div className={styles.guideList}>{guides.map((guide) => <Link href={`/guias/${guide.slug}`} className={styles.guide} key={guide.slug}>
            <div className={styles.guideImage}>{guide.picks[0] && <Image src={guide.picks[0].product.image} alt="" fill sizes="(max-width: 700px) 88px, 140px"/>}</div>
            <div><span>{guide.count} produtos <i/> de {formatPrice(guide.stats.minPrice)} a {formatPrice(guide.stats.maxPrice)}</span><h3>{guide.title}</h3></div><ArrowUpRight aria-hidden="true"/>
          </Link>)}</div>
        </div></section> : null
      case 'howItWorks':
        return <section className={`${styles.howItWorks} container`} aria-labelledby="how-title">
          <h2 id="how-title">{withBreaks(s.title ?? '')}</h2>
          <div><p>{s.text}</p><Link href="/como-funciona">{s.buttonLabel} <ArrowUpRight aria-hidden="true"/></Link></div>
        </section>
      default:
        return <CmsBlock section={section}/>
    }
  }

  return <StorefrontShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}/>
    {preview && <>
      <meta name="robots" content="noindex, nofollow"/>
      <p role="note" style={{ margin: 0, padding: '8px 16px', background: '#1c2434', color: '#fff', textAlign: 'center', fontSize: 14 }}>Prévia do rascunho: só quem edita vê isto. Publique no painel para ir ao ar.</p>
    </>}
    <div className={styles.home}>
      {sections.map((section) => <Fragment key={section.id}>{render(section)}</Fragment>)}
    </div>
  </StorefrontShell>
}
