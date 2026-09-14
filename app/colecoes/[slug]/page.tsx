import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductGrid } from '@/components/product/product-card'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { collections, products } from '@/lib/mock-data'
export function generateStaticParams(){return collections.map((collection)=>({slug:collection.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const collection=collections.find((item)=>item.slug===slug);return collection?{title:collection.title,description:collection.description,alternates:{canonical:`/colecoes/${slug}`},openGraph:{title:collection.title,description:collection.description,url:`https://garimpo.example/colecoes/${slug}`}}:{title:'Coleção não encontrada'}}
export default async function CollectionPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const collection=collections.find((item)=>item.slug===slug);if(!collection)notFound();const items=products.filter((product)=>collection.productIds.includes(product.id));return <StorefrontShell><section className="page-hero container"><div className="breadcrumbs">Início / Coleções / {collection.title}</div><div className="kicker">{collection.tone.toUpperCase()}</div><h1>{collection.title}</h1><p>{collection.description} Curadoria demonstrativa atualizada em setembro de 2026.</p></section><section className="container section" style={{paddingTop:20}}><ProductGrid items={items}/></section></StorefrontShell>}
