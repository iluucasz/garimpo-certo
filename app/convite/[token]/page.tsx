import { InviteAccept } from '@/components/storefront/invite-accept'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

export const metadata = { title: 'Convite para a equipe', robots: { index: false, follow: false } }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <StorefrontShell><InviteAccept token={token}/></StorefrontShell>
}
