import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/product/product-detail'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'

const base='https://garimpo.example'
export async function generateStaticParams(){const{products}=await getStoreCatalog();return products.map((product)=>({slug:product.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const{products}=await getStoreCatalog();const product=products.find((item)=>item.slug===slug);if(!product)return{title:'Produto não encontrado'};return{title:product.name,description:product.description,alternates:{canonical:`/produto/${product.slug}`},openGraph:{type:'website',url:`${base}/produto/${product.slug}`,title:product.name,description:product.description,images:[{url:product.image,alt:product.name}]},twitter:{card:'summary_large_image',title:product.name,description:product.description,images:[product.image]}}}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const{slug}=await params
  const{products,offers,providers}=await getStoreCatalog()
  const product=products.find((item)=>item.slug===slug)
  if(!product)notFound()
  const productOffers=offers.filter((offer)=>offer.productId===product.id)
  const jsonLd={'@context':'https://schema.org','@type':'Product',name:product.name,image:product.images,description:product.description,brand:{'@type':'Brand',name:product.brand},aggregateRating:{'@type':'AggregateRating',ratingValue:product.rating,reviewCount:product.reviews},offers:{'@type':'AggregateOffer',priceCurrency:'BRL',lowPrice:Math.min(...productOffers.map((offer)=>offer.price)),highPrice:Math.max(...productOffers.map((offer)=>offer.price)),offerCount:productOffers.length,offers:productOffers.map((offer)=>({'@type':'Offer',price:offer.price,priceCurrency:'BRL',availability:offer.stock==='indisponível'?'https://schema.org/OutOfStock':'https://schema.org/InStock',seller:{'@type':'Organization',name:providers.find((provider)=>provider.id===offer.providerId)?.name}}))}}
  return <StorefrontShell><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}}/><ProductDetail product={product}/></StorefrontShell>
}
