import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'
import { getSetting } from '@/lib/settings'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSetting('seo')
  // Indexação desligada em Conteúdo → SEO: pede a todos os robôs para não rastrear nada.
  if (seo.indexing === false) return { rules: { userAgent: '*', disallow: '/' } }
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/conta', '/redefinir-senha'] }, sitemap: `${siteUrl}/sitemap.xml` }
}
