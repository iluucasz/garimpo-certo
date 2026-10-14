import { AffiliateClickTracker } from '@/components/affiliate-click-tracker'
import { ConsentedAnalytics } from '@/components/consented-analytics'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Manrope } from 'next/font/google'
import { VisitorStateProvider } from '@/components/visitor-state-provider'
import { StoreDataProvider } from '@/components/store-data-provider'
import { toClientCatalog } from '@/lib/catalog/client-catalog'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { getProductMetrics } from '@/lib/db/repositories/product-metrics'
import { siteUrl } from '@/lib/site'
import { getSetting } from '@/lib/settings'
import { resolveRules } from '@/lib/catalog/rules'
import { StorefrontConfigProvider } from '@/components/storefront/storefront-config'
import { resolveStorefrontConfig } from '@/lib/site-builder/storefront-config'
import './globals.css'

const bodyFont=DM_Sans({subsets:['latin'],variable:'--font-body'})
const displayFont=Manrope({subsets:['latin'],variable:'--font-display'})
export async function generateMetadata():Promise<Metadata>{
  const seo=await getSetting('seo')
  const title=String(seo.siteTitle)
  const description=String(seo.description)
  const image=String(seo.ogImageUrl||'')||'/og-default.png'
  const verification=String(seo.googleVerification||'')
  return{
    metadataBase:new URL(siteUrl),
    title:{default:title,template:String(seo.titleTemplate)},
    description,
    applicationName:'Garimpo',authors:[{name:'Garimpo'}],creator:'Garimpo',publisher:'Garimpo',category:'shopping',
    alternates:{canonical:'/'},
    icons:{icon:[{url:'/favicon-48.png',sizes:'48x48',type:'image/png'},{url:'/icon-192.png',sizes:'192x192',type:'image/png'}],apple:[{url:'/apple-icon.png',sizes:'180x180'}]},
    openGraph:{type:'website',locale:'pt_BR',siteName:'Garimpo',title,description,url:'/',...(image?{images:[{url:image}]}:{})},
    twitter:{card:'summary_large_image',title,description,...(image?{images:[image]}:{})},
    robots:seo.indexing===false?{index:false,follow:false}:{index:true,follow:true},
    ...(verification?{verification:{google:verification}}:{}),
  }
}
export const viewport:Viewport={colorScheme:'light',themeColor:'#ffffff',userScalable:true}
export default async function RootLayout({children}:{children:React.ReactNode}){const [catalog,metrics,ranking,slots,config,rulesSetting]=await Promise.all([getStoreCatalog(),getProductMetrics(),getSetting('ranking'),getSetting('slots'),resolveStorefrontConfig(),getSetting('rules')]);return <html lang="pt-BR" className="bg-background"><body className={`${bodyFont.variable} ${displayFont.variable} font-sans antialiased`}><StoreDataProvider data={toClientCatalog(catalog)} metrics={metrics} ranking={ranking} slots={slots} rules={resolveRules(rulesSetting)}><StorefrontConfigProvider value={config}><VisitorStateProvider>{children}<AffiliateClickTracker/>{process.env.NODE_ENV==='production'&&<ConsentedAnalytics/>}</VisitorStateProvider></StorefrontConfigProvider></StoreDataProvider></body></html>}
