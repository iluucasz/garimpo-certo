import { AuthForm } from '@/components/storefront/auth-form'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
export const metadata={title:'Recuperar senha'}
export default function RecoverPage(){return <StorefrontShell><section className="auth-shell"><AuthForm mode="recuperar"/></section></StorefrontShell>}
