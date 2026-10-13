import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { googleEnabled } from '@/lib/auth/providers'

export const metadata = { title: 'Criar conta' }

export default function SignupPage() {
  return <StorefrontShell><AuthForm mode="cadastro" googleEnabled={googleEnabled()}/></StorefrontShell>
}
