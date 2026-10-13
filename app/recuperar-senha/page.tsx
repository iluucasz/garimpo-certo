import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export const metadata = { title: 'Recuperar senha' }

export default function RecoverPage() {
  return <StorefrontShell><AuthForm mode="recuperar"/></StorefrontShell>
}
