'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, Eraser, PlugZap, RefreshCw, XCircle } from 'lucide-react'
import { defaultRolePermissions, type AdminRole, type Permission } from '@/lib/auth/rbac'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { CatalogImportButton } from './catalog-import-button'
import { ResourceManager } from './resource-manager'
import { useAdminAccess } from './admin-access'
import styles from './resource.module.css'

const number = new Intl.NumberFormat('pt-BR')

// ---------------------------------------------------------------- importações
export function ImportsView() {
  const [refresh, setRefresh] = useState(0)
  return <div className={styles.stack}>
    <section className="panel">
      <h2>Importar agora</h2>
      <p className={styles.lead}>Busca as ofertas atuais na Shopee, atualiza preço e vendas e arquiva o que saiu da seleção (só quando a importação cobre pelo menos 70% do catálogo atual). Produtos que você editou mantêm nome, categoria e selos. A importação automática roda todo dia às 06:00 (Brasília), no worker da VPS; cada execução aparece na lista abaixo.</p>
      <CatalogImportButton onDone={() => setRefresh((value) => value + 1)}/>
    </section>
    <ResourceManager key={refresh} slug="importacoes"/>
  </div>
}

// ---------------------------------------------------------------- cupons
export function CouponsView() {
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes('content:write')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)

  async function sync() {
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      const result = await adminFetch<{ fetched: number; created: number; updated: number }>('/api/v1/admin/coupons/sync', { method: 'POST' })
      setMessage(`${result.fetched} campanhas lidas na Shopee: ${result.created} novas (entram ocultas) e ${result.updated} atualizadas.`)
      setVersion((value) => value + 1)
    } catch (reason) {
      setFailed(true)
      setMessage(reason instanceof AdminApiError ? reason.message : 'Falha ao sincronizar.')
    } finally {
      setBusy(false)
    }
  }

  return <div className={styles.stack}>
    <div className={styles.note}><div>
      <strong>Como funciona.</strong> A API de afiliados da Shopee não informa cupons nem códigos. Aqui você cadastra os que encontra (com validade e link de afiliado) e eles aparecem em <a href="/cupons" target="_blank" rel="noreferrer noopener">/cupons</a> para quem visita o site.
      O botão “Buscar campanhas da Shopee” traz as páginas oficiais de categoria que a Shopee disponibiliza para afiliados; elas entram <em>ocultas</em> para você escolher quais exibir e renomear (os nomes vêm em inglês).
    </div></div>
    <ResourceManager key={version} slug="cupons" toolbar={canWrite && <button className="btn secondary" onClick={sync} disabled={busy} aria-busy={busy}><RefreshCw className={busy ? 'spin' : undefined} aria-hidden="true"/> {busy ? 'Buscando…' : 'Buscar campanhas da Shopee'}</button>}
      intro={message ? <p className={`${styles.note} ${failed ? styles.warn : ''}`} role={failed ? 'alert' : 'status'}>{message}</p> : null}/>
  </div>
}

// ---------------------------------------------------------------- eventos
type EventsData = {
  totals: { last24h: number; last7d: number; last30d: number; total: number }
  byName: { name: string; count: number; last_at: string }[]
  byDay: { day: string; count: number }[]
  oldest: string | null
  outboundClicks: { total: number; last7d: number; sessions: number }
  disabledEvents: string[]
  retentionDays: number
}

export function EventsView() {
  const { permissions } = useAdminAccess()
  const canPurge = permissions.includes('settings:write')
  const { data, error, mutate } = useSWR<EventsData>('/api/v1/admin/events', swrFetcher, { revalidateOnFocus: false })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (error) return <div className="panel"><p className={styles.error} role="alert">Não foi possível carregar os eventos.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  async function purge() {
    if (!window.confirm(`Apagar eventos com mais de ${data!.retentionDays} dias? Isso não pode ser desfeito.`)) return
    setBusy(true)
    try {
      const result = await adminFetch<{ removed: number }>('/api/v1/admin/events', { method: 'DELETE' })
      setMessage(`${number.format(result.removed)} eventos antigos apagados.`)
      await mutate()
    } catch (reason) {
      setMessage(reason instanceof AdminApiError ? reason.message : 'Falha ao limpar.')
    } finally {
      setBusy(false)
    }
  }

  const peak = Math.max(1, ...data.byDay.map((row) => row.count))
  return <div className={styles.stack}>
    <section className="stat-grid" aria-label="Volumes">
      <div className="stat-card"><span>Eventos (24 h)</span><strong>{number.format(data.totals.last24h)}</strong><small>medidos com permissão</small></div>
      <div className="stat-card"><span>Eventos (7 dias)</span><strong>{number.format(data.totals.last7d)}</strong><small>{number.format(data.totals.last30d)} em 30 dias</small></div>
      <div className="stat-card"><span>Cliques de compra</span><strong>{number.format(data.outboundClicks.total)}</strong><small>{number.format(data.outboundClicks.last7d)} nos últimos 7 dias</small></div>
      <div className="stat-card"><span>Mais antigo guardado</span><strong style={{ fontSize: 20 }}>{data.oldest ? dateTime(data.oldest).slice(0, 10) : '—'}</strong><small>retenção de {data.retentionDays} dias</small></div>
    </section>

    <section className="panel">
      <h2>Eventos por dia (14 dias)</h2>
      {data.byDay.length === 0 ? <p className={styles.help}>Nenhum evento no período. Eventos só são gravados para visitantes que aceitaram a medição.</p> : <>
        <div className={styles.bars} role="img" aria-label={`Eventos por dia: ${data.byDay.map((row) => `${row.day}: ${row.count}`).join('; ')}`}>
          {data.byDay.map((row) => <div className={styles.bar} key={row.day} style={{ height: `${Math.max(4, (row.count / peak) * 100)}%` }} title={`${row.day}: ${row.count}`}/>)}
        </div>
        <div className={styles.barLabels} aria-hidden="true">{data.byDay.map((row) => <span key={row.day}>{row.day.slice(8)}</span>)}</div>
      </>}
    </section>

    <section className="panel">
      <h2>Por tipo (30 dias)</h2>
      <div className="table-scroll"><table className="data-table" aria-label="Eventos por tipo">
        <thead><tr><th scope="col">Evento</th><th scope="col">Quantidade</th><th scope="col">Último</th><th scope="col">Situação</th></tr></thead>
        <tbody>
          {data.byName.map((row) => <tr key={row.name}>
            <td><code>{row.name}</code></td><td>{number.format(row.count)}</td><td>{dateTime(row.last_at)}</td>
            <td><span className={`${styles.badge} ${data.disabledEvents.includes(row.name) ? styles.badgeWarn : styles.badgeOn}`}>{data.disabledEvents.includes(row.name) ? 'Desligado' : 'Gravando'}</span></td>
          </tr>)}
          {data.byName.length === 0 && <tr><td colSpan={4}>Nenhum evento nos últimos 30 dias.</td></tr>}
        </tbody>
      </table></div>
      <p className={styles.help} style={{ marginTop: 12 }}>Para desligar um tipo de evento ou mudar a retenção, use Sistema → Medição.</p>
    </section>

    {canPurge && <section className="panel">
      <h2>Retenção</h2>
      <p className={styles.lead}>Apaga os eventos mais antigos que {data.retentionDays} dias (valor definido em Medição). Os cliques de compra, usados para comissão, não são apagados.</p>
      <button className="btn secondary" onClick={purge} disabled={busy}><Eraser aria-hidden="true"/> Limpar eventos antigos</button>
      {message && <p role="status" style={{ marginTop: 10 }}>{message}</p>}
    </section>}
  </div>
}

// ---------------------------------------------------------------- integrações
type Check = { id: string; name: string; description: string; configured: boolean; testable: boolean; env: string[] }
type TestResult = { status: 'ok' | 'error'; message: string; latencyMs: number }

export function IntegrationsView() {
  const { permissions } = useAdminAccess()
  const canTest = permissions.includes('settings:write')
  const { data, error } = useSWR<{ checks: Check[]; sender: { name: string | null; email: string } | null; siteUrl: string | null }>('/api/v1/admin/integrations', swrFetcher, { revalidateOnFocus: false })
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [testing, setTesting] = useState<string | null>(null)

  if (error) return <div className="panel"><p className={styles.error} role="alert">Não foi possível carregar as integrações.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  async function test(id: string) {
    setTesting(id)
    try {
      const result = await adminFetch<TestResult>('/api/v1/admin/integrations', { method: 'POST', body: JSON.stringify({ id }) })
      setResults((current) => ({ ...current, [id]: result }))
    } catch (reason) {
      setResults((current) => ({ ...current, [id]: { status: 'error', message: reason instanceof AdminApiError ? reason.message : 'Falha no teste.', latencyMs: 0 } }))
    } finally {
      setTesting(null)
    }
  }

  return <div className={styles.stack}>
    <p className={styles.note}>Os valores secretos ficam nas variáveis de ambiente do servidor (Vercel) e nunca aparecem aqui; o painel só mostra se estão configurados e permite testar a conexão.</p>
    <div className={styles.grid2}>
      {data.checks.map((check) => {
        const result = results[check.id]
        return <article className={styles.card} key={check.id}>
          <div className={styles.cardHead}>
            <h3>{check.name}</h3>
            <span className={`${styles.badge} ${check.configured ? styles.badgeOn : styles.badgeWarn}`}>{check.configured ? <CheckCircle2 aria-hidden="true" size={14}/> : <XCircle aria-hidden="true" size={14}/>}{check.configured ? 'Configurado' : 'Faltando'}</span>
          </div>
          <p>{check.description}</p>
          <p><small>Variáveis: {check.env.map((name) => <code key={name}>{name} </code>)}</small></p>
          {check.id === 'email' && data.sender && <p><small>Remetente: {data.sender.name ? `${data.sender.name} ` : ''}&lt;{data.sender.email}&gt;</small></p>}
          {check.testable && canTest && <div className={styles.actionsRow}>
            <button className="btn secondary" onClick={() => test(check.id)} disabled={!check.configured || testing === check.id} aria-busy={testing === check.id}><PlugZap aria-hidden="true"/> {testing === check.id ? 'Testando…' : 'Testar conexão'}</button>
          </div>}
          {result && <p role="status" className={`${styles.note} ${result.status === 'error' ? styles.warn : ''}`} style={{ margin: 0 }}>{result.status === 'ok' ? 'OK' : 'Falhou'}: {result.message}{result.latencyMs ? ` (${result.latencyMs} ms)` : ''}</p>}
        </article>
      })}
    </div>
  </div>
}

// ---------------------------------------------------------------- logs
type LogEntry = { id: string; at: string; level: 'erro' | 'aviso'; source: string; message: string; detail: string | null }

export function LogsView() {
  const { data, error, mutate, isLoading } = useSWR<{ entries: LogEntry[] }>('/api/v1/admin/logs', swrFetcher, { revalidateOnFocus: false })
  return <div className="panel">
    <div className="admin-toolbar">
      <p className={styles.lead} style={{ margin: 0 }}>Importações que falharam ou terminaram sem resultado e tarefas em segundo plano que desistiram. Vazio é bom sinal.</p>
      <button className="btn secondary" onClick={() => mutate()}><RefreshCw aria-hidden="true"/> Atualizar</button>
    </div>
    {error && <p className={styles.error} role="alert">Não foi possível carregar os registros.</p>}
    <div className="table-scroll"><table className="data-table" aria-label="Problemas recentes">
      <thead><tr><th scope="col">Quando</th><th scope="col">Nível</th><th scope="col">Origem</th><th scope="col">O que aconteceu</th></tr></thead>
      <tbody>
        {(data?.entries ?? []).map((entry) => <tr key={entry.id}>
          <td>{dateTime(entry.at)}</td>
          <td><span className={`${styles.badge} ${entry.level === 'erro' ? styles.badgeWarn : ''}`}>{entry.level === 'erro' ? 'Erro' : 'Aviso'}</span></td>
          <td>{entry.source}</td>
          <td><div className={styles.cellTitle}><strong>{entry.message}</strong>{entry.detail && <small>{entry.detail}</small>}</div></td>
        </tr>)}
        {!isLoading && data && data.entries.length === 0 && <tr><td colSpan={4}><div className="empty-state compact"><CheckCircle2 aria-hidden="true"/><h2>Sem problemas registrados</h2><p>Nenhuma importação falhou e nenhuma tarefa ficou pendente com erro.</p></div></td></tr>}
      </tbody>
    </table></div>
  </div>
}

// ---------------------------------------------------------------- usuários e papéis
const permissionLabels: Record<Permission, string> = {
  'catalog:read': 'Ver catálogo e painel',
  'catalog:write': 'Editar catálogo e ranking',
  'content:write': 'Editar conteúdo, cupons e campanhas',
  'analytics:read': 'Ver analytics e logs',
  'jobs:run': 'Rodar importações',
  'settings:write': 'Alterar configurações e integrações',
  'users:manage': 'Gerenciar usuários, LGPD e auditoria',
}
const roleLabels: Record<AdminRole, string> = {
  OWNER: 'Proprietário', ADMIN: 'Administrador', MARKETING: 'Marketing', CATALOG_MANAGER: 'Gestor de catálogo',
  ANALYST: 'Analista', SUPPORT: 'Suporte', READ_ONLY: 'Somente leitura',
}

function PermissionMatrix() {
  const roles = Object.keys(defaultRolePermissions) as AdminRole[]
  const all = Object.keys(permissionLabels) as Permission[]
  return <section className="panel">
    <h2>O que cada papel pode fazer</h2>
    <div className="table-scroll"><table className={styles.matrix} aria-label="Permissões por papel">
      <thead><tr><th scope="col">Permissão</th>{roles.map((role) => <th scope="col" key={role}>{roleLabels[role]}</th>)}</tr></thead>
      <tbody>{all.map((permission) => <tr key={permission}>
        <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>{permissionLabels[permission]}</th>
        {roles.map((role) => <td key={role}>{defaultRolePermissions[role].includes(permission) ? <span className={styles.yes} aria-label="Sim">✓</span> : <span className={styles.no} aria-label="Não">—</span>}</td>)}
      </tr>)}</tbody>
    </table></div>
    <p className={styles.help} style={{ marginTop: 10 }}>Esta é a matriz padrão gravada no banco por <code>pnpm db:seed-roles</code>. Contas novas não recebem papel algum.</p>
  </section>
}

export function UsersView() {
  return <div className={styles.stack}><ResourceManager slug="usuarios"/><PermissionMatrix/></div>
}

export function SecurityView() {
  return <div className={styles.stack}>
    <ResourceManager slug="sessoes"/>
    <PermissionMatrix/>
  </div>
}
