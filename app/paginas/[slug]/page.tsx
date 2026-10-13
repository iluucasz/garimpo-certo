import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageBlock } from '@/components/home/page-block'
import { SectionFrame } from '@/components/home/section-frame'
import { StorefrontConfigProvider } from '@/components/storefront/storefront-config'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getPageDocument } from '@/lib/db/repositories/site-documents'
import { sectionTypes, visibleSections, type SiteDocument } from '@/lib/site-builder/document'
import { canPreviewDrafts } from '@/lib/site-builder/preview'
import { resolveStorefrontConfig } from '@/lib/site-builder/storefront-config'
import { siteUrl } from '@/lib/site'
import styles from '@/components/home/home.module.css'

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }

/** Título para a aba e os buscadores: o digitado na página, ou o título do primeiro bloco com título. */
const titleOf = (document: SiteDocument, slug: string) =>
  document.page?.title || document.sections.find((section) => section.settings.title)?.settings.title || slug

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { slug } = await params
  const document = await getPageDocument(slug)
  // Página que não está no ar não deve ser indexada (a prévia só abre para quem edita).
  if (!document) return { robots: { index: false, follow: false } }
  const title = titleOf(document, slug)
  const description = document.page?.description
  return {
    title,
    description,
    alternates: { canonical: `/paginas/${slug}` },
    openGraph: { title: `${title} · Garimpo certo`, description, url: `${siteUrl}/paginas/${slug}` },
  }
}

/** Páginas criadas em Painel → Páginas (landing pages, campanhas, textos institucionais). Só blocos livres. */
export default async function LandingPage({ params, searchParams }: Params) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const preview = query.preview === '1' && await canPreviewDrafts()
  const document = await getPageDocument(slug, { preview })
  if (!document) notFound()
  const sections = visibleSections(document).filter((section) => !sectionTypes[section.type].builtin)

  const page = <StorefrontShell>
    {preview && <>
      <meta name="robots" content="noindex, nofollow"/>
      <p role="note" style={{ margin: 0, padding: '8px 16px', background: '#1c2434', color: '#fff', textAlign: 'center', fontSize: 14 }}>Prévia do rascunho: só quem edita vê isto. Publique no painel para ir ao ar.</p>
    </>}
    <h1 className="sr-only">{titleOf(document, slug)}</h1>
    <div className={styles.home}>
      {sections.map((section) => <Fragment key={section.id}>
        <SectionFrame section={section} preview={preview}><PageBlock section={section}/></SectionFrame>
      </Fragment>)}
    </div>
  </StorefrontShell>

  return preview ? <StorefrontConfigProvider value={await resolveStorefrontConfig({ preview: true })}>{page}</StorefrontConfigProvider> : page
}
