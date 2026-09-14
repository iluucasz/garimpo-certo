import { AdminShell } from '@/components/admin/admin-shell'
export const metadata={title:{default:'Admin demonstrativo',template:'%s · Garimpo Admin'},robots:{index:false,follow:false}}
export default function AdminLayout({children}:{children:React.ReactNode}){return <AdminShell>{children}</AdminShell>}
