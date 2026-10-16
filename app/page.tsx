import { Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { CampaignBanner } from '@/components/home/campaign-banner'
import { PageBlock } from '@/components/home/page-block'
import { SectionFrame } from '@/components/home/section-frame'
import { HomeCatalog } from '@/components/home/home-catalog'
import { HomeSelections } from '@/components/home/home-selections'
import { HeroStat } from '@/components/home/hero-stat'
import { HeroCopy } from '@/components/home/hero-copy'
import { getRunningExperiment } from '@/lib/db/repositories/experiments'
import { FeaturedProducts } from '@/components/home/featured-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { StorefrontConfigProvider } from '@/components/storefront/storefront-config'
import { resolveStorefrontConfig } from '@/lib/site-builder/storefront-config'
import { visibleSections } from '@/lib/site-builder/document'
import { canPreviewDrafts } from '@/lib/site-builder/preview'
import { buildCollections } from '@/lib/catalog/collections'
import { buildGuide, guideSlugs } from '@/lib/catalog/guides'
import { featuredProductIds, pickCollectionProducts } from '@/lib/site-builder/collection-picks'
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

/** Quebra de linha digitada no editor vira <br/> (o título da seção "Como funciona" usa duas linhas). */
const withBreaks = (text: string) => text.split('\n').map((line, index, all) => <Fragment key={index}>{line}{index < all.length - 1 && <br/>}</Fragment>)

export default async function Home({ searchParams }: { searchParams: Promise<{ filtro?: string; preview?: string }> }) {
  const params = await searchParams
  const activeFilter = validFilters.includes(params.filtro as HomeFilter) ? params.filtro as HomeFilter : 'trending'
  const preview = params.preview === '1' && await canPreviewDrafts()
  const [baseCatalog, campaigns, checklists, document, running] = await Promise.all([
    getStoreCatalog(), getActiveCampaigns(), getGuideChecklists(), getRenderDocument('home', { preview }),
    // Na prévia do rascunho não há sorteio: a equipe vê o que escreveu.
    preview ? Promise.resolve(null) : getRunningExperiment().catch(() => null),
  ])
  const catalog = { ...baseCatalog, checklists }
  const guides = guideSlugs(catalog).flatMap((slug) => { const guide = buildGuide(catalog, slug); return guide ? [guide] : [] }).slice(0, 3)
  const sections = visibleSections(document)
  const hasCatalog = sections.some((section) => section.type === 'catalog')
  // Cada produto aparece uma vez na home: as coleções pulam o que a vitrine principal já mostra e o que as de cima mostraram.
  const collectionBlocks = sections.filter((section) => section.type === 'collection')
  const picks = collectionBlocks.length === 0 ? new Map<string, string[]>() : pickCollectionProducts(
    collectionBlocks,
    buildCollections({ ...catalog, rules: await getCatalogRules() }),
    hasCatalog ? featuredProductIds(catalog.products, catalog.offers) : [],
  )

  function render(section: (typeof sections)[number]) {
    const s = section.settings
    switch (section.type) {
      case 'hero':
        return <section className={`${styles.hero} container`} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <HeroStat/>
            <HeroCopy
              control={{ title: s.title ?? '', accent: s.accent ?? '', text: s.text ?? '', buttonLabel: s.buttonLabel ?? '' }}
              experiment={running ? { key: running.key, splitB: running.splitB, variantB: running.variantB } : null}
              ctaHref={hasCatalog ? '#ofertas' : '/buscar'}/>
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
          <div className={styles.guideIntro}><h2 id="guides-title">{s.title}</h2>{s.text && <p>{s.text}</p>}<Link href="/guias">{s.buttonLabel} <ArrowRight aria-hidden="true"/></Link></div>
          <div className={styles.guideList}>{guides.map((guide) => <Link href={`/guias/${guide.slug}`} className={styles.guide} key={guide.slug}>
            <div className={styles.guideImage}>{guide.picks[0] && <Image src={guide.picks[0].product.image} alt="" fill sizes="(max-width: 700px) 88px, 140px"/>}</div>
            <div><span>{guide.count} produtos <i/> de {formatPrice(guide.stats.minPrice)} a {formatPrice(guide.stats.maxPrice)}</span><h3>{guide.title}</h3></div><ArrowUpRight aria-hidden="true"/>
          </Link>)}</div>
        </div></section> : null
      case 'howItWorks':
        return <section className={`${styles.howItWorks} container`} aria-labelledby="how-title">
          <h2 id="how-title">{withBreaks(s.title ?? '')}</h2>
          <div>{s.text && <p>{s.text}</p>}<Link href="/como-funciona">{s.buttonLabel} <ArrowUpRight aria-hidden="true"/></Link></div>
        </section>
      default:
        return <PageBlock section={section} productIds={picks.get(section.id)}/>
    }
  }

  const page = <StorefrontShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}/>
    {preview && <>
      <meta name="robots" content="noindex, nofollow"/>
      <p role="note" style={{ margin: 0, padding: '8px 16px', background: '#1c2434', color: '#fff', textAlign: 'center', fontSize: 14 }}>Prévia do rascunho: só quem edita vê isto. Publique no painel para ir ao ar.</p>
    </>}
    <div className={styles.home}>
      {sections.map((section) => <SectionFrame key={section.id} section={section} preview={preview}>{render(section)}</SectionFrame>)}
    </div>
  </StorefrontShell>

  // Na prévia, o tema, o aviso do topo e o rodapé também mostram o rascunho da Aparência do site.
  return preview ? <StorefrontConfigProvider value={await resolveStorefrontConfig({ preview: true })}>{page}</StorefrontConfigProvider> : page
}
