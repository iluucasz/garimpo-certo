import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/content/markdown'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getPublishedContent, getPublishedContentBySlug } from '@/lib/db/repositories/site-content'
import { siteUrl } from '@/lib/site'
import styles from '@/components/storefront/content-pages.module.css'

export const revalidate = 86400

export async function generateStaticParams() {
  return (await getPublishedContent('page')).map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublishedContentBySlug('page', slug)
  if (!page) notFound()
  const description = page.seoDescription || page.summary || undefined
  const title = page.seoTitle || page.title
  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}` },
    openGraph: { title: `${title} · Garimpo certo`, description, url: `${siteUrl}/p/${slug}` },
  }
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await getPublishedContentBySlug('page', slug)
  if (!page) notFound()
  return <StorefrontShell>
    <article className={styles.prose}>
      <h1>{page.title}</h1>
      {page.summary && <p className={styles.intro}>{page.summary}</p>}
      <Markdown source={page.body}/>
    </article>
  </StorefrontShell>
}
