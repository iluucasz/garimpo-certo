import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { TwoFactorChallenge } from '@/components/storefront/two-factor-challenge'

export const metadata = { title: 'Verificação em duas etapas', robots: { index: false, follow: false } }

export default function VerifyPage() {
  return <StorefrontShell><TwoFactorChallenge/></StorefrontShell>
}
