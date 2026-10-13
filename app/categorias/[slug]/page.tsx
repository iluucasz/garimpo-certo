import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { SearchExperience } from '@/components/search/search-experience'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { ContentSkeleton } from '@/components/storefront/store-loading'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { siteUrl } from '@/lib/site'
export async function generateStaticParams(){const{categories}=await getStoreCatalog();return categories.map((category)=>({slug:category.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const{categories}=await getStoreCatalog();const category=categories.find((item)=>item.slug===slug);return category?{title:category.name,description:category.description,alternates:{canonical:`/categorias/${slug}`},openGraph:{title:`Produtos de ${category.name}`,description:category.description,url:`${siteUrl}/categorias/${slug}`}}:notFound()}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const{categories}=await getStoreCatalog();if(!categories.some((category)=>category.slug===slug))notFound();return <StorefrontShell><Suspense fallback={<ContentSkeleton/>}><SearchExperience initialCategory={slug}/></Suspense></StorefrontShell>}
