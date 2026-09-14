import type { MetadataRoute } from 'next'
import { articles, collections } from '@/lib/mock-data'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const base='https://garimpo.example';const{products,categories}=await getStoreCatalog();const paths=['','/buscar','/guias','/como-funciona','/privacidade',...products.map(x=>`/produto/${x.slug}`),...categories.map(x=>`/categorias/${x.slug}`),...collections.map(x=>`/colecoes/${x.slug}`),...articles.map(x=>`/guias/${x.slug}`)];return paths.map(url=>({url:`${base}${url}`,lastModified:new Date('2026-09-04'),changeFrequency:url.includes('/produto/')?'daily':'weekly',priority:url===''?1:.7}))}
