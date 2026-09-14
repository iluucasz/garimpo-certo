import { SavedProducts } from '@/components/storefront/saved-products'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export const metadata={title:'Favoritos'}
export default function FavoritesPage(){return <StorefrontShell><section className="page-hero container"><div className="kicker">SUA CURADORIA</div><h1>Favoritos</h1><p>Produtos guardados neste navegador.</p></section><SavedProducts mode="favorites"/></StorefrontShell>}
