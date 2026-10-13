import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { googleEnabled } from '@/lib/auth/providers'

export const metadata = { title: 'Entrar' }

export default function LoginPage() {
  return <StorefrontShell><AuthForm mode="entrar" googleEnabled={googleEnabled()}/></StorefrontShell>
}
