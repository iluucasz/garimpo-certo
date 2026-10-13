import type { MetadataRoute } from 'next'
import { collectionSlugsFor } from '@/lib/catalog/collections'
import { guideSlugs } from '@/lib/catalog/guides'
import { getPublishedContent, getStorefrontNav } from '@/lib/db/repositories/site-content'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { siteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, articles, pages, nav] = await Promise.all([getStoreCatalog(), getPublishedContent('article'), getPublishedContent('page'), getStorefrontNav()])
  const lastModified = new Date(new Date().toISOString().slice(0, 10))
  const entries: { path: string; frequency: 'daily' | 'weekly'; priority: number }[] = [
    { path: '', frequency: 'daily', priority: 1 },
    { path: '/buscar', frequency: 'daily', priority: 0.8 },
    { path: '/colecoes', frequency: 'daily', priority: 0.7 },
    { path: '/guias', frequency: 'weekly', priority: 0.6 },
    { path: '/como-funciona', frequency: 'weekly', priority: 0.4 },
    { path: '/privacidade', frequency: 'weekly', priority: 0.3 },
    ...(nav.coupons ? [{ path: '/cupons', frequency: 'daily' as const, priority: 0.6 }] : []),
    ...(articles.length ? [{ path: '/artigos', frequency: 'weekly' as const, priority: 0.5 }] : []),
    ...articles.map((article) => ({ path: `/artigos/${article.slug}`, frequency: 'weekly' as const, priority: 0.5 })),
    ...pages.map((page) => ({ path: `/p/${page.slug}`, frequency: 'weekly' as const, priority: 0.3 })),
    ...catalog.categories.map((category) => ({ path: `/categorias/${category.slug}`, frequency: 'daily' as const, priority: 0.7 })),
    ...collectionSlugsFor(catalog).map((slug) => ({ path: `/colecoes/${slug}`, frequency: 'daily' as const, priority: 0.6 })),
    ...guideSlugs(catalog).map((slug) => ({ path: `/guias/${slug}`, frequency: 'weekly' as const, priority: 0.6 })),
    ...catalog.products.map((product) => ({ path: `/produto/${product.slug}`, frequency: 'daily' as const, priority: 0.6 })),
  ]
  return entries.map((entry) => ({ url: `${siteUrl}${entry.path}`, lastModified, changeFrequency: entry.frequency, priority: entry.priority }))
}
