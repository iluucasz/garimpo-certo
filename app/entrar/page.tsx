import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export const metadata={title:'Entrar'}
export default function LoginPage(){return <StorefrontShell><section className="auth-shell"><AuthForm mode="entrar"/></section></StorefrontShell>}
