import { Suspense } from 'react'
import { SearchExperience } from '@/components/search/search-experience'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export const metadata={title:'Descobrir produtos'}
export default function SearchPage(){return <StorefrontShell><Suspense fallback={<div className="container section">Carregando catálogo…</div>}><SearchExperience/></Suspense></StorefrontShell>}
