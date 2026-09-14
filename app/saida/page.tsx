import { AffiliateExit } from '@/components/storefront/affiliate-exit'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export const metadata = { title: 'Saída para loja parceira' }

export default async function ExitPage({ searchParams }: { searchParams: Promise<{ produto?: string; loja?: string; oferta?: string }> }) {
  const query = await searchParams
  return <StorefrontShell><section className="auth-shell"><AffiliateExit product={query.produto ?? ''} store={query.loja ?? 'loja parceira'} offer={query.oferta}/></section></StorefrontShell>
}
