import { Suspense } from 'react'
import { SearchExperience, type SearchParams } from '@/components/search/search-experience'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { ContentSkeleton } from '@/components/storefront/store-loading'

export const metadata = { title: 'Descobrir produtos' }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams
  const initialParams: SearchParams = {
    q: first(raw.q), categoria: first(raw.categoria), ordem: first(raw.ordem),
    precoMax: first(raw.precoMax), sinais: first(raw.sinais), pagina: first(raw.pagina),
  }
  return <StorefrontShell><Suspense fallback={<ContentSkeleton/>}><SearchExperience initialParams={initialParams}/></Suspense></StorefrontShell>
}
