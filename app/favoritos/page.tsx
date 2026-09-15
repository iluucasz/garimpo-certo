import { FavoritesCollection } from '@/components/storefront/favorites-collection'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export const metadata = { title: 'Favoritos' }
export default function FavoritesPage() { return <StorefrontShell><FavoritesCollection/></StorefrontShell> }
