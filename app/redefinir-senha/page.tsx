import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/storefront/reset-password-form'
import { ContentSkeleton } from '@/components/storefront/store-loading'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export const metadata = { title: 'Nova senha', robots: { index: false, follow: false } }

export default function ResetPasswordPage() {
  return <StorefrontShell><Suspense fallback={<ContentSkeleton/>}><ResetPasswordForm/></Suspense></StorefrontShell>
}
