'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Download, GripVertical, Pencil, Play, Plus, RotateCcw, Save, Search, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react'
import type { ModuleConfig } from '@/lib/admin-config'
import { LocalRepository, platformServices, type PlatformRecord } from '@/lib/platform'
import { JobsConsole } from './jobs-console'
import { useAdminAccess } from './admin-access'
import { ModuleWorkbench } from './module-workbench'
import { ExperienceStudio, hasExperienceStudio } from './experience-studio'
import { AnalyticsStudio } from './analytics-studio'
import { hasOperationsStudio, OperationsStudio } from './operations-studio'

type AdminRow = PlatformRecord & { status: string }
type Notify = (message: string) => void

function seedRows(config: ModuleConfig): AdminRow[] {
  return config.rows.map((row, index) => ({ id: `${config.slug}_${index + 1}`, ...Object.fromEntries(config.columns.map((column, columnIndex) => [column, row[columnIndex] ?? ''])), status: row.at(-1) ?? 'Ativo' }))
}

export function ModuleContent({ config }: { config: ModuleConfig }) {
  const [toast, setToast] = useState('')
  const { roles, allowed } = useAdminAccess()
  const canRead = allowed(config.slug)
  const canMutate = allowed(config.slug, true)
  const notify: Notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  if (!canRead) return <div className="panel access-denied"><h1>Acesso restrito</h1><p>O papel atual não possui permissão para visualizar este módulo.</p></div>
  function protect(event: React.MouseEvent<HTMLDivElement> | React.FormEvent<HTMLDivElement>) { if (canMutate) return; const target = event.target as HTMLElement; if (target.closest('.btn.primary,.btn.danger,.row-actions button,.toggle,.builder-block,.adapter-card')) { event.preventDefault(); event.stopPropagation(); notify('Seu papel possui acesso somente leitura neste módulo.') } }
  return <div onClickCapture={protect} onSubmitCapture={protect}><div className="admin-title"><div><div className="kicker">{config.group.toUpperCase()}</div><h1>{config.title}</h1><p>{config.description} Operando como {roles.join(', ')}.</p></div></div>{!canMutate && <div className="permission-banner"><ShieldCheck/> Modo somente leitura</div>}<ModuleWorkbench config={config} notify={notify} disabled={!canMutate}/>{hasExperienceStudio(config.slug) ? <ExperienceStudio slug={config.slug} disabled={!canMutate} notify={notify}/> : hasOperationsStudio(config.slug) ? <OperationsStudio/> : config.slug === 'imports-jobs' ? <JobsConsole/> : config.kind === 'table' && <TableView config={config} notify={notify} canMutate={canMutate}/>} {!hasExperienceStudio(config.slug) && config.kind === 'builder' && <BuilderView config={config} notify={notify}/>} {config.kind === 'analytics' && <AnalyticsView config={config}/>} {!hasExperienceStudio(config.slug) && config.kind === 'settings' && <SettingsView config={config} notify={notify}/>} {!hasOperationsStudio(config.slug) && config.kind === 'governance' && <GovernanceView config={config} notify={notify}/>} {toast && <div className="toast" role="status"><Check/> {toast}</div>}</div>
}

function TableView({ config, notify, canMutate }: { config: ModuleConfig; notify: Notify; canMutate: boolean }) {
  const repository = useMemo(() => new LocalRepository<AdminRow>(`garimpo:admin:${config.slug}`, seedRows(config)), [config])
  const [rows, setRows] = useState<AdminRow[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirming, setConfirming] = useState<AdminRow | null>(null)

  async function load() { const result = await repository.list({ search, status, pageSize: 100 }); setRows(result.items) }
  useEffect(() => { void load() }, [repository, search, status])
  const statuses = useMemo(() => [...new Set(seedRows(config).map((row) => row.status))], [config])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const values = Object.fromEntries(config.columns.map((column) => [column, String(data.get(column) ?? '')])) as Omit<AdminRow, 'id'>
    values.status = String(values[config.columns.at(-1) ?? ''] ?? 'Ativo')
    if (editing) await repository.update(editing.id, values)
    else await repository.create(values)
    platformServices.tracker.track({ name: editing ? 'admin_record_updated' : 'admin_record_created', resource: config.slug, resourceId: editing?.id, actor: 'Marina' })
    setEditing(null); setCreating(false); await load(); notify(editing ? 'Registro atualizado no repositório mock.' : 'Registro criado no repositório mock.')
  }

  async function remove() {
    if (!confirming) return
    await repository.remove(confirming.id)
    platformServices.tracker.track({ name: 'admin_record_deleted', resource: config.slug, resourceId: confirming.id, actor: 'Marina' })
    setConfirming(null); await load(); notify('Registro excluído do repositório mock.')
  }

  function exportCsv() {
    const csv = [config.columns.join(';'), ...rows.map((row) => config.columns.map((column) => String(row[column] ?? '')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${config.slug}-mock.csv`; link.click(); URL.revokeObjectURL(url)
    notify('CSV exportado com os registros filtrados.')
  }

  return <div className="panel"><div className="admin-toolbar"><div className="header-search"><Search/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar em ${config.title.toLowerCase()}`} aria-label={`Buscar em ${config.title}`}/></div><div className="toolbar-actions"><label className="select-wrap"><span className="sr-only">Filtrar status</span><SlidersHorizontal/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos os status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown/></label><button className="btn secondary" onClick={exportCsv}><Download/> Exportar</button><button className="btn primary" disabled={!canMutate} onClick={() => setCreating(true)}><Plus/> {config.action}</button></div></div><div className="table-scroll"><table className="data-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th>Ações</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{config.columns.map((column, index) => <td key={column}>{index === config.columns.length - 1 ? <span className="status">{String(row[column])}</span> : String(row[column])}</td>)}<td><div className="row-actions"><button aria-label="Editar registro" disabled={!canMutate} onClick={() => setEditing(row)}><Pencil/></button><button aria-label="Excluir registro" disabled={!canMutate} onClick={() => setConfirming(row)}><Trash2/></button></div></td></tr>) : <tr><td colSpan={config.columns.length + 1}><div className="empty-state compact"><Search/><h2>Nenhum registro encontrado</h2><button className="btn secondary" onClick={() => { setSearch(''); setStatus('todos') }}>Limpar filtros</button></div></td></tr>}</tbody></table></div>{(creating || editing) && <RecordDrawer title={editing ? `Editar em ${config.title}` : config.action} columns={config.columns} record={editing} onClose={() => { setEditing(null); setCreating(false) }} onSubmit={submit}/>} {confirming && <ConfirmDialog title="Excluir registro?" description={`A exclusão de “${String(confirming[config.columns[0]])}” será persistida neste navegador.`} onCancel={() => setConfirming(null)} onConfirm={remove}/>}</div>
}

function RecordDrawer({ title, columns, record, onClose, onSubmit }: { title: string; columns: string[]; record: AdminRow | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header><div><div className="kicker">EDITOR MOCK</div><h2 id="drawer-title">{title}</h2></div><button className="icon-btn static" onClick={onClose} aria-label="Fechar editor"><X/></button></header><form className="form-stack" onSubmit={onSubmit}>{columns.map((column, index) => <label key={column}>{column}{index === columns.length - 1 ? <select className="select" name={column} defaultValue={String(record?.[column] ?? 'Ativo')}><option>Ativo</option><option>Ativa</option><option>Publicado</option><option>Publicada</option><option>Rascunho</option><option>Revisão</option><option>Alerta</option><option>Desativado</option></select> : <input className="input" name={column} defaultValue={String(record?.[column] ?? '')} required/>}</label>)}<div className="drawer-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn primary" type="submit"><Save/> Salvar registro</button></div></form></aside></div>
}

function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="drawer-backdrop"><div className="confirm-dialog" role="alertdialog" aria-modal="true"><h2>{title}</h2><p>{description}</p><div className="drawer-actions"><button className="btn secondary" onClick={onCancel}>Cancelar</button><button className="btn danger" onClick={onConfirm}>Excluir</button></div></div></div>
}

function BuilderView({ config, notify }: { config: ModuleConfig; notify: Notify }) {
  const defaults = config.slug === 'tema' ? ['Cores da marca', 'Tipografia', 'Bordas e raio', 'Botões'] : config.slug === 'segmentos' ? ['Visitou categoria', 'Faixa de preço', 'Favoritou produto', 'Não clicou em oferta'] : ['Hero editorial', 'Categorias', 'Radar em alta', 'Coleção', 'Guias']
  const storageKey = `garimpo:builder:${config.slug}`
  const [blocks, setBlocks] = useState(defaults)
  const [selected, setSelected] = useState(0)
  const [title, setTitle] = useState(config.title)
  const dragIndex = useRef<number | null>(null)
  useEffect(() => { try { const saved = localStorage.getItem(storageKey); if (saved) { const state = JSON.parse(saved); setBlocks(state.blocks ?? defaults); setTitle(state.title ?? config.title) } } catch {} }, [storageKey, config.title])
  function move(from: number, to: number) { if (from === to) return; setBlocks((current) => { const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next }); setSelected(to) }
  function save() { localStorage.setItem(storageKey, JSON.stringify({ blocks, title })); platformServices.tracker.track({ name: 'builder_published', resource: config.slug, actor: 'Marina' }); notify('Versão publicada no armazenamento mock.') }
  return <div className="builder"><div className="builder-list"><h2>Blocos</h2>{blocks.map((block, index) => <button draggable onDragStart={() => { dragIndex.current = index }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex.current !== null) move(dragIndex.current, index) }} onClick={() => setSelected(index)} className={selected === index ? 'builder-block active' : 'builder-block'} key={`${block}-${index}`}><GripVertical/> {block}</button>)}<button className="btn secondary full" onClick={() => { setBlocks((current) => [...current, `Novo bloco ${current.length + 1}`]); setSelected(blocks.length) }}><Plus/> Adicionar bloco</button></div><div className="builder-preview"><div className="kicker">PREVIEW EM TEMPO REAL</div><div className="live-preview"><small>{blocks[selected]?.toUpperCase() ?? 'PRÉVIA'}</small><h2>{title}</h2><p>{config.slug === 'segmentos' ? `${blocks.length} condições combinadas nesta audiência.` : `${blocks.length} blocos publicados nesta composição.`}</p><button className="btn primary">Ação principal</button></div></div><div className="builder-settings"><h2>Configurações</h2><div className="form-stack"><label>Título<input className="input" value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>Bloco selecionado<input className="input" value={blocks[selected] ?? ''} onChange={(event) => setBlocks((current) => current.map((item, index) => index === selected ? event.target.value : item))}/></label><label>Visibilidade<select className="select"><option>Todos</option><option>Segmento específico</option></select></label><button className="btn secondary" onClick={() => { setBlocks(defaults); setTitle(config.title) }}><RotateCcw/> Restaurar</button><button className="btn primary" onClick={save}><Save/> {config.action}</button></div></div></div>
}

function AnalyticsView({ config }: { config: ModuleConfig }) {
  if (config.slug === 'analytics' || config.slug === 'funil') return <AnalyticsStudio mode={config.slug}/>
  const events = typeof window === 'undefined' ? [] : platformServices.tracker.list()
  const values = config.slug === 'funil' ? [100, 62, 38, 17] : [42, 68, 54, 88, 72, 96, Math.max(30, events.length * 5)]
  return <><div className="stat-grid"><Stat label="Sessões" value="128.402" delta="+12,4%"/><Stat label="Buscas" value="46.891" delta="+8,7%"/><Stat label="Eventos locais" value={String(events.length)} delta="adapter mock"/><Stat label="CTR médio" value="4,82%" delta="+0,6 p.p."/></div><div className="admin-grid"><div className="panel"><h2>{config.slug === 'funil' ? 'Conversão por etapa' : 'Atividade da plataforma'}</h2><div className="chart">{values.map((value, index) => <div className="chart-col" key={index}><strong>{value}{config.slug === 'funil' ? '%' : ''}</strong><div className="chart-bar" style={{ height: `${value * 1.5}px` }}/><span>{config.slug === 'funil' ? ['Visita', 'Busca', 'Produto', 'Clique'][index] : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][index]}</span></div>)}</div></div><div className="panel"><h2>Eventos recentes</h2>{events.slice(0, 6).map((event) => <div className="toggle-row" key={event.id}><span><strong>{event.name}</strong><small>{event.resource} · {event.actor}</small></span><small>{new Date(event.timestamp).toLocaleTimeString('pt-BR')}</small></div>)}{!events.length && <p>Interaja com a storefront para gerar eventos locais.</p>}</div></div></>
}

function SettingsView({ config, notify }: { config: ModuleConfig; notify: Notify }) {
  const fields = config.slug === 'ranking' ? ['Qualidade', 'Preço competitivo', 'Confiança da oferta', 'Afinidade', 'Frescor'] : config.slug === 'seo' ? ['Título padrão', 'Descrição padrão', 'Canonical base', 'Indexação'] : config.slug === 'ai' ? ['Classificação automática', 'Resumo de atributos', 'Moderação editorial', 'Sugestões de tags'] : config.slug === 'recommendation-slots' ? ['Home: para você', 'PDP: similares', 'Busca: recuperação', 'Conta: retomada'] : ['Coleta de page views', 'Eventos de produto', 'Cliques afiliados', 'Respeitar consentimento']
  const key = `garimpo:settings:${config.slug}`
  const [values, setValues] = useState<Record<string, number | boolean>>(() => Object.fromEntries(fields.map((field, index) => [field, config.slug === 'ranking' ? 80 - index * 10 : true])))
  useEffect(() => { try { const saved = localStorage.getItem(key); if (saved) setValues(JSON.parse(saved)) } catch {} }, [key])
  function save() { localStorage.setItem(key, JSON.stringify(values)); platformServices.tracker.track({ name: 'settings_updated', resource: config.slug, actor: 'Marina' }); notify('Configurações persistidas no adapter mock.') }
  return <div className="admin-grid"><div className="panel"><h2>Configuração principal</h2>{fields.map((field) => <div className="toggle-row" key={field}><span><strong>{field}</strong><small>Regra demonstrativa configurável</small></span>{config.slug === 'ranking' ? <input aria-label={`Peso de ${field}`} type="range" value={Number(values[field])} onChange={(event) => setValues((current) => ({ ...current, [field]: Number(event.target.value) }))}/> : <button className={`toggle ${values[field] ? 'on' : ''}`} aria-label={`Alternar ${field}`} aria-pressed={Boolean(values[field])} onClick={() => setValues((current) => ({ ...current, [field]: !current[field] }))}/>}</div>)}<button className="btn primary" style={{ marginTop: 18 }} onClick={save}><Save/> Salvar alterações</button></div><div className="panel"><h2>Ambiente</h2><div className="form-stack"><label>Status<select className="select"><option>Simulação ativa</option><option>Desativado</option></select></label><label>Fallback<input className="input" defaultValue="Curadoria editorial"/></label><label>Observações<textarea className="textarea" defaultValue="Contrato pronto para integração real."/></label></div></div></div>
}

function GovernanceView({ config, notify }: { config: ModuleConfig; notify: Notify }) {
  const [rules, setRules] = useState(['Retenção de eventos por 90 dias', 'Revisão trimestral de acessos', 'Exportação com trilha de auditoria', 'Consentimento versionado'])
  const [sessions, setSessions] = useState(3)
  function exportReport() { const url = URL.createObjectURL(new Blob([JSON.stringify({ module: config.slug, rules, sessions }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${config.slug}-report.json`; link.click(); URL.revokeObjectURL(url); notify('Relatório de governança exportado.') }
  return <div className="admin-grid"><div className="panel"><h2>{config.slug === 'lgpd' ? 'Solicitações de titulares' : 'Controles de segurança'}</h2>{rules.map((rule) => <div className="toggle-row" key={rule}><span>{rule}</span><button className="status" onClick={() => setRules((current) => current.filter((item) => item !== rule))}>Ativo</button></div>)}</div><div className="panel"><h2>Ações</h2><p>{sessions} sessões administrativas simuladas ativas.</p><div className="form-stack"><button className="btn secondary" onClick={exportReport}><Download/> Gerar relatório</button><button className="btn secondary" onClick={() => { setRules((current) => [...current, `Revisão iniciada ${new Date().toLocaleTimeString('pt-BR')}`]); notify('Revisão adicionada à trilha local.') }}><Play/> Iniciar revisão</button><button className="btn danger" disabled={!sessions} onClick={() => { setSessions(0); notify('Sessões mock revogadas.') }}>Revogar sessões</button></div></div></div>
}

function Stat({ label, value, delta }: { label: string; value: string; delta: string }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{delta} no período</small></div> }
