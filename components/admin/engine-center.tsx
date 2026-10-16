'use client'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, ArrowRight, Check, CircleDot, Clock, Play, Send, Sparkles, X } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { formatPrice } from '@/lib/format'
import type { ActivityItem, EngineOverview, EngineTask, PostView, ProposalView, TaskState } from '@/lib/engine/overview'
import { changePercent, type Pair, type WeeklyDigest } from '@/lib/engine/digest'
import { useAdminAccess } from './admin-access'
import { CatalogImportButton } from './catalog-import-button'
import { SettingsForm } from './settings-form'
import styles from './engine-center.module.css'

type ShadowData = { shadow: ProposalView[] }
type Tab = 'geral' | 'aprovacoes' | 'semana' | 'importacao' | 'aprendizado' | 'ajustes' | 'historico'

const number = new Intl.NumberFormat('pt-BR')

const modeInfo = {
  off: { label: 'Desligada', text: '' },
  shadow: { label: 'Sombra', text: 'Só registra.' },
  approval: { label: 'Com aprovação', text: 'Pede o seu OK.' },
  auto: { label: 'Automática', text: 'Aplica o que é reversível.' },
} as const

const stateLabel: Record<TaskState, string> = { ok: 'Em dia', attention: 'Precisa de atenção', idle: 'Aguardando dados', off: 'Desligada' }
const workerLabel = { online: 'Worker online', stale: 'Worker atrasado', offline: 'Worker parado', unknown: 'Worker sem sinal ainda' } as const
const evidenceLabels: Record<string, string> = {
  views: 'visitas', clicks: 'cliques', favorites: 'favoritos', conversions: 'compras', siteViews: 'visitas no site', siteClicks: 'cliques no site',
  windowDays: 'dias analisados', daysUntil: 'dias para a data', clickShare: '% dos cliques', productShare: '% dos produtos',
}

function relative(iso: string | null) {
  if (!iso) return '—'
  return dateTime(iso)
}

/** Central da Engine: o que ela faz, o que espera você, o que aprendeu e o que já fez. */
export function EngineCenter() {
  const { permissions } = useAdminAccess()
  const canDecide = permissions.includes('catalog:write')
  const canRun = permissions.includes('jobs:run')
  const { data, error, mutate } = useSWR<EngineOverview>('/api/v1/admin/engine/overview', swrFetcher, { revalidateOnFocus: false, refreshInterval: 60_000 })
  const { data: shadowData, mutate: mutateShadow } = useSWR<ShadowData>('/api/v1/admin/engine', swrFetcher, { revalidateOnFocus: false })
  const [tab, setTab] = useState<Tab>('geral')
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function act(id: string, work: () => Promise<string>) {
    setBusy(id); setMessage(''); setFailed(false)
    try {
      setMessage(await work())
      await Promise.all([mutate(), mutateShadow()])
    } catch (reason) {
      setFailed(true); setMessage(reason instanceof AdminApiError ? reason.message : 'Não foi possível concluir.')
    } finally { setBusy(null) }
  }

  const runEngine = () => act('run', async () => {
    const state = await adminFetch<{ mode: string; created: number; refreshed: number; expired: number; applied: number }>('/api/v1/admin/engine', { method: 'POST' })
    return state.mode === 'off' ? 'A Engine está desligada.' : `Execução concluída: ${state.created} novas, ${state.refreshed} atualizadas, ${state.expired} expiradas${state.applied ? `, ${state.applied} aplicadas` : ''}.`
  })

  const decideProposal = (proposal: ProposalView, decision: 'approve' | 'reject') => {
    if (decision === 'approve' && !window.confirm(`Aprovar e aplicar agora?\n\n${proposal.title}`)) return
    return act(proposal.id, async () => {
      const result = await adminFetch<{ status: string; result: { error?: string } | null }>(`/api/v1/admin/engine/proposals/${proposal.id}`, { method: 'POST', body: JSON.stringify({ decision }) })
      if (result.status === 'failed') throw new AdminApiError(`Não foi possível aplicar: ${result.result?.error ?? 'erro desconhecido'}.`, 409, {})
      return decision === 'approve' ? 'Aprovada e aplicada.' : 'Recusada. A Engine não volta a sugerir isso por 30 dias.'
    })
  }

  /** Troca só o modo: lê a configuração atual e grava de volta com o modo novo. */
  const changeMode = (next: EngineOverview['master']['engine']) => act('mode', async () => {
    const current = await adminFetch<{ value: Record<string, unknown> }>('/api/v1/admin/settings/engine')
    await adminFetch('/api/v1/admin/settings/engine', { method: 'PUT', body: JSON.stringify({ ...current.value, mode: next }) })
    setSettingsVersion((value) => value + 1)
    return `Modo alterado para “${modeInfo[next].label}”.`
  })

  const decidePost = (post: PostView, action: 'approve' | 'cancel') => act(post.id, async () => {
    await adminFetch(`/api/v1/admin/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ action }) })
    return action === 'approve' ? 'Postagem aprovada: sai no horário marcado.' : 'Postagem cancelada.'
  })

  const approveAllPosts = (posts: PostView[]) => {
    if (!window.confirm(`Aprovar as ${posts.length} postagens de uma vez? Elas saem nos horários marcados.`)) return
    return act('all', async () => {
      let done = 0
      for (const post of posts) {
        await adminFetch(`/api/v1/admin/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) })
        done++
      }
      return `${done} postagens aprovadas.`
    })
  }

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar a central da Engine.</p></div>
  if (!data) return <div className="panel" role="status">Carregando a Engine…</div>

  const waiting = data.approvals.proposals.length + data.approvals.posts.length
  const mode = modeInfo[data.master.engine]
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'geral', label: 'Visão geral' },
    { id: 'aprovacoes', label: 'Aprovações', count: waiting },
    { id: 'semana', label: 'Resumo da semana' },
    { id: 'importacao', label: 'Importação' },
    { id: 'aprendizado', label: 'Aprendizado' },
    { id: 'ajustes', label: 'Modo e regras' },
    { id: 'historico', label: 'Histórico' },
  ]

  return <div className={styles.center}>
    <section className={`panel ${styles.hero}`} aria-labelledby="engine-hero">
      <div className={styles.heroMain}>
        <p className={styles.eyebrow}>Estado da Engine</p>
        <h2 id="engine-hero">{data.master.engine === 'off' ? 'A Engine está desligada' : waiting > 0 ? `${waiting} ${waiting === 1 ? 'coisa espera' : 'coisas esperam'} a sua decisão` : 'A Engine está trabalhando'}</h2>
        <p className={styles.heroText}>
          <span className={`${styles.pill} ${styles[`mode_${data.master.engine}`]}`}>{mode.label}</span>
          {' '}{mode.text}
        </p>
        <p className={styles.heroMeta}>
          <span className={`${styles.dot} ${styles[`worker_${data.worker.state}`]}`} aria-hidden="true"/>
          {workerLabel[data.worker.state]}{data.worker.lastBeatAt ? ` · último sinal ${dateTime(data.worker.lastBeatAt)}` : ''}
          
        </p>
      </div>
      <div className={styles.heroActions}>
        {canRun && <button type="button" className="btn primary" onClick={runEngine} disabled={busy === 'run' || data.master.engine === 'off'} aria-busy={busy === 'run'}>
          <Play aria-hidden="true"/> {busy === 'run' ? 'Rodando…' : 'Rodar a Engine agora'}
        </button>}
        {canRun && <CatalogImportButton onDone={() => void mutate()}/>}
      </div>
      {message && <p className={failed ? styles.bad : styles.good} role={failed ? 'alert' : 'status'}>{message}</p>}
    </section>

    <div className={styles.tabs} role="tablist" aria-label="Seções da Engine">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? styles.tabOn : undefined} onClick={() => setTab(item.id)}>
        {item.label}{item.count ? <b>{item.count}</b> : null}
      </button>)}
    </div>

    {tab === 'geral' && <Overview data={data} goTo={setTab}/>}
    {tab === 'aprovacoes' && <Approvals data={data} shadow={shadowData?.shadow ?? []} canDecide={canDecide} busy={busy} onProposal={decideProposal} onPost={decidePost} onApproveAll={approveAllPosts}/>}
    {tab === 'semana' && <WeekTab/>}
    {tab === 'importacao' && <ImportTab data={data}/>}
    {tab === 'aprendizado' && <LearningTab data={data}/>}
    {tab === 'ajustes' && <div className={styles.stack}>
      <section className="panel" aria-labelledby="engine-mode">
        <h3 id="engine-mode" className={styles.sectionTitle}>Quanto a Engine pode fazer sozinha</h3>
        <div className={styles.modes} role="radiogroup" aria-label="Modo da Engine">
          {(Object.keys(modeInfo) as (keyof typeof modeInfo)[]).map((id) => <button
            key={id} type="button" role="radio" aria-checked={data.master.engine === id} disabled={!canDecide || busy === 'mode'}
            className={`${styles.mode} ${data.master.engine === id ? styles.modeOn : ''}`} onClick={() => data.master.engine !== id && void changeMode(id)}
          >
            <strong>{modeInfo[id].label}</strong>
            <span>{modeInfo[id].text}</span>
          </button>)}
        </div>
      </section>
      <section className={styles.settingsWrap} aria-label="Regras da Engine"><SettingsForm key={settingsVersion} settingKey="engine"/></section>
    </div>}
    {tab === 'historico' && <History items={data.activity}/>}
  </div>
}

// ---------------------------------------------------------------- visão geral

function Overview({ data, goTo }: { data: EngineOverview; goTo: (tab: Tab) => void }) {
  const { today, catalog, commissions } = data
  return <div className={styles.stack}>
    <div className={styles.kpis}>
      <div className={styles.kpi}><span>Produtos na vitrine</span><strong>{number.format(catalog.products)}</strong><small>{number.format(catalog.withAffiliate)} com link de afiliado</small></div>
      <div className={styles.kpi}><span>Postagens de hoje</span><strong>{today.sent}<i> / {today.dailyLimit}</i></strong><small>{today.pending > 0 ? `${today.pending} na fila` : 'nenhuma na fila'}{today.nextPostAt ? ` · próxima ${dateTime(today.nextPostAt)}` : ''}</small></div>
      <div className={styles.kpi}><span>Esperando você</span><strong>{data.approvals.proposals.length + data.approvals.posts.length}</strong><small>{data.approvals.posts.length} postagens · {data.approvals.proposals.length} sugestões</small></div>
      <div className={styles.kpi}><span>Comissão em {commissions.days} dias</span><strong>{formatPrice(commissions.confirmed + commissions.pending)}</strong><small>{formatPrice(commissions.confirmed)} confirmada · {formatPrice(commissions.telegram)} do Telegram</small></div>
    </div>

    {data.attention.length > 0 && <section className={`panel ${styles.attention}`} aria-label="Pontos de atenção">
      <h3><AlertTriangle aria-hidden="true"/> Pontos de atenção</h3>
      <ul>{data.attention.map((check) => <li key={check.id}><strong>{check.label}</strong> — {check.message}</li>)}</ul>
    </section>}

    <section aria-labelledby="engine-tasks">
      <h3 id="engine-tasks" className={styles.sectionTitle}>O que a Engine faz</h3>
      <div className={styles.tasks}>
        {data.tasks.map((task) => <TaskCard key={task.id} task={task} goTo={goTo}/>)}
      </div>
    </section>
  </div>
}

function TaskCard({ task, goTo }: { task: EngineTask; goTo: (tab: Tab) => void }) {
  const target: Tab | null = task.id === 'import' ? 'importacao' : task.id === 'learn' ? 'aprendizado' : task.id === 'engine' ? 'ajustes' : null
  return <article className={`${styles.task} ${styles[`task_${task.state}`]}`}>
    <header>
      <h4>{task.title}</h4>
      <span className={`${styles.state} ${styles[`state_${task.state}`]}`}>{task.id === 'engine' && task.state === 'idle' ? 'Modo sombra' : stateLabel[task.state]}</span>
    </header>
    <p className={styles.taskWhat}>{task.what}</p>
    <dl className={styles.facts}>
      <div><dt><Clock aria-hidden="true"/> Quando</dt><dd>{task.schedule}</dd></div>
      <div><dt><Check aria-hidden="true"/> Última vez</dt><dd>{task.last ? <>{relative(task.last.at)}<br/><small>{task.last.summary}</small></> : 'ainda não rodou'}</dd></div>
      <div><dt><CircleDot aria-hidden="true"/> Próxima</dt><dd>{task.nextAt ? relative(task.nextAt) : '—'}</dd></div>
    </dl>
    {task.note && <p className={styles.taskNote}>{task.note}</p>}
    <footer>
      {target
        ? <button type="button" className={styles.link} onClick={() => goTo(target)}>Configurar <ArrowRight aria-hidden="true"/></button>
        : <Link className={styles.link} href={`/admin/${task.href}`}>Abrir <ArrowRight aria-hidden="true"/></Link>}
    </footer>
  </article>
}

// ---------------------------------------------------------------- aprovações

function Approvals({ data, shadow, canDecide, busy, onProposal, onPost, onApproveAll }: {
  data: EngineOverview; shadow: ProposalView[]; canDecide: boolean; busy: string | null
  onProposal: (proposal: ProposalView, decision: 'approve' | 'reject') => void
  onPost: (post: PostView, action: 'approve' | 'cancel') => void
  onApproveAll: (posts: PostView[]) => void
}) {
  const { proposals, posts } = data.approvals
  return <div className={styles.stack}>
    {proposals.length === 0 && posts.length === 0 && <section className="panel"><p className={styles.empty}>Nada esperando você.</p></section>}

    {posts.length > 0 && <section className="panel" aria-labelledby="ap-posts">
      <div className={styles.rowHead}>
        <h3 id="ap-posts"><Send aria-hidden="true"/> Postagens para aprovar ({posts.length})</h3>
        {canDecide && posts.length > 1 && <button type="button" className="btn secondary" disabled={busy === 'all'} onClick={() => onApproveAll(posts)}><Check aria-hidden="true"/> Aprovar todas</button>}
      </div>
      <ul className={styles.list}>
        {posts.map((post) => <li key={post.id} className={styles.card}>
          {post.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={post.imageUrl} alt="" className={styles.thumb} loading="lazy"/>}
          <div className={styles.cardMain}>
            <strong>{post.name}</strong>
            <p className={styles.preview}>{post.text}</p>
            <small>{post.price !== null ? `${formatPrice(post.price)} · ` : ''}{post.scheduledFor ? `sai ${dateTime(post.scheduledFor)}` : 'sem horário'} · {post.source === 'engine' ? 'sugerida pela Engine' : 'criada por você'} · campanha {post.campaign}</small>
          </div>
          {canDecide && <div className={styles.cardActions}>
            <button type="button" className="btn primary" disabled={busy === post.id} onClick={() => onPost(post, 'approve')}><Check aria-hidden="true"/> Aprovar</button>
            <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => onPost(post, 'cancel')}><X aria-hidden="true"/> Cancelar</button>
            <Link className={styles.link} href="/admin/postagens">Editar texto</Link>
          </div>}
        </li>)}
      </ul>
    </section>}

    {proposals.length > 0 && <section className="panel" aria-labelledby="ap-prop">
      <h3 id="ap-prop" className={styles.h3}><Sparkles aria-hidden="true"/> Sugestões da Engine ({proposals.length})</h3>
      <ul className={styles.list}>
        {proposals.map((proposal) => <li key={proposal.id} className={styles.card}>
          <div className={styles.cardMain}>
            <span className={styles.kind}>{proposal.kindLabel}</span>
            <strong>{proposal.title}</strong>
            <p className={styles.preview}>{proposal.reason}</p>
            <ul className={styles.evidence} aria-label="Números que justificam">
              {Object.entries(proposal.evidence).filter(([key]) => key in evidenceLabels).map(([key, value]) => <li key={key}><strong>{String(value)}</strong> {evidenceLabels[key]}</li>)}
            </ul>
            <small>sugerida em {dateTime(proposal.createdAt)}{proposal.expiresAt ? ` · vale até ${dateTime(proposal.expiresAt)}` : ''}</small>
          </div>
          {canDecide && <div className={styles.cardActions}>
            <button type="button" className="btn primary" disabled={busy === proposal.id} onClick={() => onProposal(proposal, 'approve')}><Check aria-hidden="true"/> Aprovar</button>
            <button type="button" className="btn secondary" disabled={busy === proposal.id} onClick={() => onProposal(proposal, 'reject')}><X aria-hidden="true"/> Recusar</button>
          </div>}
        </li>)}
      </ul>
    </section>}

    {shadow.length > 0 && <details className={`panel ${styles.collapse}`}>
      <summary><span>Registro do modo sombra</span><small>{shadow.length} {shadow.length === 1 ? 'sugestão registrada' : 'sugestões registradas'}, sem pedir nada</small></summary>
      <ul className={styles.list}>
        {shadow.map((proposal) => <li key={proposal.id} className={styles.card}>
          <div className={styles.cardMain}>
            <span className={styles.kind}>{proposal.kindLabel}</span>
            <strong>{proposal.title}</strong>
            <p className={styles.preview}>{proposal.reason}</p>
          </div>
        </li>)}
      </ul>
    </details>}
  </div>
}

// ---------------------------------------------------------------- resumo da semana

const channelLabel: Record<string, string> = { site: 'Site', telegram: 'Telegram', whatsapp: 'WhatsApp', unknown: 'Sem etiqueta' }

function Delta({ pair }: { pair: Pair }) {
  const change = changePercent(pair)
  if (change === null) return <small>{pair.previous === 0 && pair.current > 0 ? 'sem base na semana anterior' : 'sem base de comparação'}</small>
  const tone = change > 0 ? styles.up : change < 0 ? styles.down : ''
  return <small>{change > 0 ? '+' : ''}{change}% <span className={tone}>{change > 0 ? 'a mais' : change < 0 ? 'a menos' : 'igual'}</span> que na semana anterior ({number.format(pair.previous)})</small>
}

/** O que mudou nos últimos 7 dias contra os 7 anteriores, o que a Engine fez e quanto rendeu. */
function WeekTab() {
  const { data, error } = useSWR<WeeklyDigest>('/api/v1/admin/engine/digest', swrFetcher, { revalidateOnFocus: false })
  if (error) return <section className="panel"><p role="alert">Não foi possível montar o resumo da semana.</p></section>
  if (!data) return <section className="panel" role="status">Montando o resumo…</section>
  const { site, commissions, engine, posts, catalog } = data
  return <div className={styles.stack}>
    {!data.measured && <section className="panel"><p className={styles.help}>Sem visitas medidas nas duas últimas semanas.</p></section>}

    <div className={styles.kpis}>
      <div className={styles.kpi}><span>Cliques de compra</span><strong>{number.format(site.clicks.current)}</strong><Delta pair={site.clicks}/></div>
      <div className={styles.kpi}><span>Visitas a produtos</span><strong>{number.format(site.views.current)}</strong><Delta pair={site.views}/></div>
      <div className={styles.kpi}><span>Favoritos novos</span><strong>{number.format(site.favorites.current)}</strong><Delta pair={site.favorites}/></div>
      <div className={styles.kpi}><span>Sessões medidas</span><strong>{number.format(site.sessions.current)}</strong><Delta pair={site.sessions}/></div>
    </div>

    <div className={styles.twoCols}>
      <section className="panel" aria-labelledby="wk-products">
        <h3 id="wk-products" className={styles.sectionTitle}>Produtos que mais geraram cliques</h3>
        {data.topProducts.length === 0 ? <p className={styles.empty}>Nenhum clique de compra medido nos últimos {data.days} dias.</p>
          : <ol className={styles.rank}>{data.topProducts.map((item) => <li key={item.id}>
            <Link href={`/produto/${item.slug}`} target="_blank" rel="noreferrer">{item.name}</Link>
            <span>{item.category ?? 'Sem categoria'} · <strong>{number.format(item.clicks)}</strong> {item.clicks === 1 ? 'clique' : 'cliques'}</span>
          </li>)}</ol>}
      </section>
      <section className="panel" aria-labelledby="wk-cats">
        <h3 id="wk-cats" className={styles.sectionTitle}>Categorias que mais renderam</h3>
        {data.topCategories.length === 0 ? <p className={styles.empty}>Nenhum clique por categoria nos últimos {data.days} dias.</p>
          : <ol className={styles.rank}>{data.topCategories.map((item) => <li key={item.slug}>
            <strong>{item.name}</strong>
            <span><strong>{number.format(item.clicks)}</strong> {item.clicks === 1 ? 'clique' : 'cliques'} · semana anterior {number.format(item.previous)}</span>
          </li>)}</ol>}
      </section>
    </div>

    <div className={styles.twoCols}>
      <section className="panel" aria-labelledby="wk-engine">
        <h3 id="wk-engine" className={styles.sectionTitle}>O que a Engine fez</h3>
        <dl className={styles.summary}>
          <div><dt>Produtos novos na vitrine</dt><dd>{number.format(catalog.added)}</dd></div>
          <div><dt>Produtos que saíram</dt><dd>{number.format(catalog.removed)}</dd></div>
          <div><dt>Sugestões criadas</dt><dd>{number.format(engine.created)}</dd></div>
          <div><dt>Sugestões aplicadas</dt><dd>{number.format(engine.applied)}</dd></div>
          <div><dt>Sugestões recusadas</dt><dd>{number.format(engine.rejected)}</dd></div>
          <div><dt>Esperando você agora</dt><dd>{number.format(engine.pending)}</dd></div>
          <div><dt>Postagens enviadas</dt><dd>{number.format(posts.sent)}</dd></div>
          <div><dt>Postagens com falha ou canceladas</dt><dd>{number.format(posts.failed + posts.cancelled)}</dd></div>
        </dl>
      </section>
      <section className="panel" aria-labelledby="wk-money">
        <h3 id="wk-money" className={styles.sectionTitle}>Quanto rendeu</h3>
        <dl className={styles.summary}>
          <div><dt>Vendas pelos seus links</dt><dd>{number.format(commissions.conversions)}</dd></div>
          <div><dt>Comissão prevista</dt><dd>{formatPrice(commissions.pending)}</dd></div>
          <div><dt>Comissão confirmada</dt><dd>{formatPrice(commissions.confirmed)}</dd></div>
          <div><dt>Cancelada ou rejeitada</dt><dd>{formatPrice(commissions.lost)}</dd></div>
        </dl>
        {commissions.byChannel.length > 0
          ? <ul className={styles.channels} aria-label="Comissão por canal">{commissions.byChannel.map((item) => <li key={item.channel}><span>{channelLabel[item.channel] ?? item.channel}</span><strong>{formatPrice(item.commission)}</strong><small>{item.conversions} {item.conversions === 1 ? 'venda' : 'vendas'}</small></li>)}</ul>
          : <p className={styles.help}>Nenhuma venda nos últimos {data.days} dias.</p>}
      </section>
    </div>
  </div>
}

// ---------------------------------------------------------------- importação

function ImportTab({ data }: { data: EngineOverview }) {
  const task = data.tasks.find((item) => item.id === 'import')
  const boosted = data.learning.categories.filter((item) => item.bonus > 0)
  return <div className={styles.stack}>
    <section className="panel">
      <h3 className={styles.sectionTitle}>Como a importação decide</h3>
      {task?.last && <p className={styles.taskNote}>Última importação: {dateTime(task.last.at)} — {task.last.summary}.{task.nextAt ? ` Próxima: ${dateTime(task.nextAt)}.` : ''}</p>}
      {boosted.length > 0 && <p className={styles.taskNote}>Cotas extras ativas por aprendizado: {boosted.map((item) => `${item.name} +${item.bonus}`).join(', ')}.</p>}
    </section>
    <section className={styles.settingsWrap} aria-label="Números da importação"><SettingsForm settingKey="import"/></section>
  </div>
}

// ---------------------------------------------------------------- aprendizado

function LearningTab({ data }: { data: EngineOverview }) {
  const { learning } = data
  const progress = Math.min(100, Math.round((learning.siteClicks / Math.max(1, learning.minSiteClicks)) * 100))
  return <div className={styles.stack}>
    <section className="panel">
      <h3 className={styles.sectionTitle}>O que a Engine aprende com os cliques</h3>
      <div className={styles.progressText}><strong>{number.format(learning.siteClicks)}</strong> de {number.format(learning.minSiteClicks)} cliques nos últimos {learning.windowDays} dias para começar a aprender {learning.enabled ? '' : '· desligado'}</div>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Cliques disponíveis para aprender"><span style={{ width: `${progress}%` }}/></div>
    </section>
    <section className="panel">
      <div className="table-scroll"><table className="data-table" aria-label="Desempenho por categoria">
        <thead><tr><th scope="col">Categoria</th><th scope="col">Produtos</th><th scope="col">Cliques</th><th scope="col">Compras</th><th scope="col">Rende vs. média</th><th scope="col">Efeito</th></tr></thead>
        <tbody>{learning.categories.map((item) => <tr key={item.slug}>
          <td>{item.name}</td><td>{number.format(item.products)}</td><td>{number.format(item.clicks)}</td><td>{number.format(item.conversions)}</td>
          <td>{learning.enough && item.products > 0 ? `${item.ratio.toFixed(1).replace('.', ',')}×` : '—'}</td>
          <td>{item.bonus > 0 ? `+${item.bonus} na importação` : item.boost > 1 ? `prioridade ${Math.round((item.boost - 1) * 100)}% nas postagens` : '—'}</td>
        </tr>)}</tbody>
      </table></div>
      {learning.categories.length === 0 && <p className={styles.empty}>Sem categorias com produtos ativos.</p>}
    </section>
  </div>
}

// ---------------------------------------------------------------- histórico

const kindLabel: Record<ActivityItem['kind'], string> = { import: 'Importação', commissions: 'Comissões', engine: 'Engine', post: 'Postagem', proposal: 'Sugestão' }

function History({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <section className="panel"><p className={styles.empty}>Nada registrado ainda.</p></section>
  return <section className="panel" aria-label="Histórico">
    <ol className={styles.timeline}>
      {items.map((item, index) => <li key={`${item.at}-${index}`} className={styles[`tone_${item.tone}`]}>
        <span className={styles.timelineDot} aria-hidden="true"/>
        <div>
          <strong>{item.title}</strong>
          <p>{item.detail}</p>
          <small>{kindLabel[item.kind]} · {dateTime(item.at)}</small>
        </div>
      </li>)}
    </ol>
  </section>
}
