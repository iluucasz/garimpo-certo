import type { MetadataRoute } from 'next'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { articles, collections } from '@/lib/mock-data'
import { editorialEnabled, siteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, categories } = await getStoreCatalog()
  const lastModified = new Date(new Date().toISOString().slice(0, 10))
  const entries: { path: string; frequency: 'daily' | 'weekly'; priority: number }[] = [
    { path: '', frequency: 'daily', priority: 1 },
    { path: '/buscar', frequency: 'daily', priority: 0.8 },
    { path: '/como-funciona', frequency: 'weekly', priority: 0.4 },
    { path: '/privacidade', frequency: 'weekly', priority: 0.3 },
    ...categories.map((category) => ({ path: `/categorias/${category.slug}`, frequency: 'daily' as const, priority: 0.7 })),
    ...products.map((product) => ({ path: `/produto/${product.slug}`, frequency: 'daily' as const, priority: 0.6 })),
    ...(editorialEnabled ? [
      { path: '/guias', frequency: 'weekly' as const, priority: 0.5 },
      ...collections.map((collection) => ({ path: `/colecoes/${collection.slug}`, frequency: 'weekly' as const, priority: 0.5 })),
      ...articles.map((article) => ({ path: `/guias/${article.slug}`, frequency: 'weekly' as const, priority: 0.5 })),
    ] : []),
  ]
  return entries.map((entry) => ({ url: `${siteUrl}${entry.path}`, lastModified, changeFrequency: entry.frequency, priority: entry.priority }))
}
