import type { MetadataRoute } from 'next'
import { editorialEnabled, siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const disallow = ['/admin/', '/api/', '/conta', '/redefinir-senha', ...(editorialEnabled ? [] : ['/colecoes/', '/guias'])]
  return { rules: { userAgent: '*', allow: '/', disallow }, sitemap: `${siteUrl}/sitemap.xml` }
}
