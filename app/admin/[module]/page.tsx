import { notFound } from 'next/navigation'
import { ModuleScreen } from '@/components/admin/module-screen'
import { adminConfigs, getAdminConfig } from '@/lib/admin-config'

export function generateStaticParams() {
  return adminConfigs.map((config) => ({ module: config.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params
  return { title: getAdminConfig(module)?.title ?? 'Admin' }
}

export default async function AdminModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params
  const config = getAdminConfig(module)
  if (!config) notFound()
  return <ModuleScreen config={config}/>
}
