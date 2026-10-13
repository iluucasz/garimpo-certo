import { HistoryCollection } from '@/components/storefront/history-collection'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export const metadata = { title: 'Vistos recentemente' }

export default function HistoryPage() {
  return <StorefrontShell><HistoryCollection/></StorefrontShell>
}
