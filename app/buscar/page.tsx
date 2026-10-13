import { Suspense } from 'react'
import { SearchExperience } from '@/components/search/search-experience'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { ContentSkeleton } from '@/components/storefront/store-loading'
export const metadata={title:'Descobrir produtos'}
export default function SearchPage(){return <StorefrontShell><Suspense fallback={<ContentSkeleton/>}><SearchExperience/></Suspense></StorefrontShell>}
