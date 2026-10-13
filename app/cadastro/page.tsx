import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export const metadata = { title: 'Criar conta' }

export default function SignupPage() {
  return <StorefrontShell><AuthForm mode="cadastro"/></StorefrontShell>
}
