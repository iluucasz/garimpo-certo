import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/content/markdown'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getPublishedContent, getPublishedContentBySlug } from '@/lib/db/repositories/site-content'
import { siteUrl } from '@/lib/site'
import contentStyles from '@/components/content/content.module.css'
import styles from '@/components/storefront/content-pages.module.css'

export const revalidate = 300

export async function generateStaticParams() {
  return (await getPublishedContent('article')).map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedContentBySlug('article', slug)
  if (!article) notFound()
  const description = article.seoDescription || article.summary || undefined
  const title = article.seoTitle || article.title
  return {
    title,
    description,
    alternates: { canonical: `/artigos/${slug}` },
    openGraph: { title: `${title} · Garimpo certo`, description, url: `${siteUrl}/artigos/${slug}`, type: 'article', ...(article.coverImageUrl ? { images: [{ url: article.coverImageUrl }] } : {}) },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getPublishedContentBySlug('article', slug)
  if (!article) notFound()
  const published = article.publishedAt ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(article.publishedAt)) : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.publishedAt ?? undefined,
    dateModified: article.updatedAt,
    description: article.summary ?? undefined,
    mainEntityOfPage: `${siteUrl}/artigos/${slug}`,
    inLanguage: 'pt-BR',
  }
  return <StorefrontShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
    <article className={styles.prose}>
      <nav className={contentStyles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><Link href="/artigos">Artigos</Link></nav>
      <h1>{article.title}</h1>
      {published && <p className={contentStyles.byline}>Publicado em {published}</p>}
      {article.summary && <p className={styles.intro}>{article.summary}</p>}
      {article.coverImageUrl && <img className={contentStyles.cover} src={article.coverImageUrl} alt="" loading="lazy" decoding="async"/>}
      <Markdown source={article.body}/>
    </article>
  </StorefrontShell>
}
