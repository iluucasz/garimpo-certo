import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { emailEnabled } from '@/lib/auth/email'

export const metadata = { title: 'Recuperar senha' }
// A tela muda conforme o ambiente tenha ou não provedor de e-mail; não pode ser pré-renderizada no build.
export const dynamic = 'force-dynamic'

export default function RecoverPage() {
  return <StorefrontShell><AuthForm mode="recuperar" emailEnabled={emailEnabled()}/></StorefrontShell>
}
