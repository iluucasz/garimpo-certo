'use client'

import type { ModuleConfig } from '@/lib/admin-config'
import { useAdminAccess } from './admin-access'
import { AnalyticsStudio } from './analytics-studio'
import { CouponsView, EventsView, ImportsView, IntegrationsView, LogsView, SecurityView, UsersView } from './admin-views'
import { ResourceManager } from './resource-manager'
import { EngineCenter } from './engine-center'
import { AbTestsView } from './ab-tests-view'
import { SettingsForm } from './settings-form'
import { SocialPostsView } from './social-posts-view'
import { SiteBuilder } from './site-builder/editor'
import { CatalogHub } from './catalog-hub'

/** Cabeçalho do módulo e a tela correspondente à sua `view`. O servidor aplica as mesmas permissões em cada chamada. */
export function ModuleScreen({ config }: { config: ModuleConfig }) {
  const { allowed, roles } = useAdminAccess()
  if (!allowed(config.slug)) {
    return <div className="panel access-denied"><h1>Acesso restrito</h1><p>O seu papel não tem permissão para ver este módulo.</p></div>
  }
  const view = config.view
  return <div>
    <div className="admin-title"><div>
      <div className="kicker">{config.group.toUpperCase()}</div>
      <h1>{config.title}</h1>
      <p>{config.description}</p>
    </div></div>
    <CatalogHub group={config.group}/>
    {!allowed(config.slug, true) && view.kind !== 'analytics' && view.kind !== 'events' && view.kind !== 'logs' && <p className="permission-banner" role="note">Você está como {roles.join(', ')} e pode apenas consultar este módulo.</p>}
    {view.kind === 'resource' && <ResourceManager slug={view.resource}/>}
    {view.kind === 'settings' && <SettingsForm settingKey={view.key}/>}
    {view.kind === 'builder' && <SiteBuilder pageKey={view.page}/>}
    {view.kind === 'engine' && <EngineCenter/>}
    {view.kind === 'posts' && <SocialPostsView/>}
    {view.kind === 'abtests' && <AbTestsView/>}
    {view.kind === 'analytics' && <AnalyticsStudio mode={view.mode}/>}
    {view.kind === 'events' && <EventsView/>}
    {view.kind === 'integrations' && <IntegrationsView/>}
    {view.kind === 'imports' && <ImportsView/>}
    {view.kind === 'logs' && <LogsView/>}
    {view.kind === 'coupons' && <CouponsView/>}
    {view.kind === 'users' && <UsersView/>}
    {view.kind === 'security' && <SecurityView/>}
  </div>
}
