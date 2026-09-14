import type { MetadataRoute } from 'next'
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:'*',allow:'/',disallow:['/admin/','/conta','/saida']},sitemap:'https://garimpo.example/sitemap.xml'}}
