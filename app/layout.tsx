import { AffiliateClickTracker } from '@/components/affiliate-click-tracker'
import { ConsentedAnalytics } from '@/components/consented-analytics'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Manrope } from 'next/font/google'
import { MockProvider } from '@/components/mock-provider'
import { StoreDataProvider } from '@/components/store-data-provider'
import { toClientCatalog } from '@/lib/catalog/client-catalog'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { getProductMetrics } from '@/lib/db/repositories/product-metrics'
import { siteUrl } from '@/lib/site'
import './globals.css'

const bodyFont=DM_Sans({subsets:['latin'],variable:'--font-body'})
const displayFont=Manrope({subsets:['latin'],variable:'--font-display'})
export const metadata:Metadata={metadataBase:new URL(siteUrl),title:{default:'Garimpo — Descobertas que valem a pena',template:'%s · Garimpo'},description:'Curadoria inteligente de produtos úteis, bonitos e com preço justo.',applicationName:'Garimpo',authors:[{name:'Garimpo'}],creator:'Garimpo',publisher:'Garimpo',category:'shopping',alternates:{canonical:'/'},openGraph:{type:'website',locale:'pt_BR',siteName:'Garimpo',title:'Garimpo — Descobertas que valem a pena',description:'Curadoria inteligente de produtos úteis, bonitos e com preço justo.',url:'/'},twitter:{card:'summary_large_image',title:'Garimpo — Descobertas que valem a pena',description:'Curadoria inteligente de produtos úteis, bonitos e com preço justo.'},robots:{index:true,follow:true}}
export const viewport:Viewport={colorScheme:'light',themeColor:'#ffffff',userScalable:true}
export default async function RootLayout({children}:{children:React.ReactNode}){const [catalog,metrics]=await Promise.all([getStoreCatalog(),getProductMetrics()]);return <html lang="pt-BR" className="bg-background"><body className={`${bodyFont.variable} ${displayFont.variable} font-sans antialiased`}><StoreDataProvider data={toClientCatalog(catalog)} metrics={metrics}><MockProvider>{children}<AffiliateClickTracker/>{process.env.NODE_ENV==='production'&&<ConsentedAnalytics/>}</MockProvider></StoreDataProvider></body></html>}
