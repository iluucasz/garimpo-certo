import { SavedProducts } from '@/components/storefront/saved-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export const metadata={title:'Histórico'}
export default function HistoryPage(){return <StorefrontShell><section className="page-hero container"><div className="kicker">REVISTOS RECENTEMENTE</div><h1>Histórico</h1><p>Produtos visitados neste navegador.</p></section><SavedProducts mode="recent"/></StorefrontShell>}
