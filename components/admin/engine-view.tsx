'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Play, X } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { useAdminAccess } from './admin-access'
import { SettingsForm } from './settings-form'
import styles from './engine-view.module.css'

type Proposal = {
  id: string; kind: string; kindLabel: string; title: string; reason: string; evidence: Record<string, unknown>
  status: string; createdAt: string; decidedAt: string | null; decisionNote: string | null; expiresAt: string | null; result: Record<string, unknown> | null
}
type EngineData = {
  settings: { mode: 'off' | 'shadow' | 'approval' | 'auto' }
  state: { at: string; mode: string; created: number; refreshed: number; expired: number; applied: number; note: string | null; coverage: { siteViews: number; minSiteViews: number; eligible: number; activeProducts: number } | null } | null
  counts: Record<string, number>
  pending: Proposal[]; shadow: Proposal[]; history: Proposal[]
}

const modeLabel = { off: 'Desligada', shadow: 'Sombra: só registra', approval: 'Com aprovação', auto: 'Automática (só o reversível)' } as const
const statusLabel: Record<string, string> = { applied: 'Aplicada', rejected: 'Recusada', failed: 'Falhou', expired: 'Expirou', pending: 'Aguardando', shadow: 'Sombra' }
const evidenceLabels: Record<string, string> = { views: 'visitas', clicks: 'cliques', favorites: 'favoritos', conversions: 'compras', siteViews: 'visitas no site', windowDays: 'dias analisados', daysUntil: 'dias para a data' }

type Tab = 'pending' | 'shadow' | 'history'

/** Área da Engine: o que ela sugeriu, o porquê e os botões para aprovar ou recusar. */
export function EngineView() {
  const { permissions } = useAdminAccess()
  const canDecide = permissions.includes('catalog:write')
  const canRun = permissions.includes('jobs:run')
  const { data, error, mutate } = useSWR<EngineData>('/api/v1/admin/engine', swrFetcher, { revalidateOnFocus: false })
  const [tab, setTab] = useState<Tab>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function run() {
    setBusy('run'); setMessage(''); setFailed(false)
    try {
      const state = await adminFetch<NonNullable<EngineData['state']>>('/api/v1/admin/engine', { method: 'POST' })
      setMessage(state.mode === 'off' ? 'A Engine está desligada.' : `Execução concluída: ${state.created} novas, ${state.refreshed} atualizadas, ${state.expired} expiradas${state.applied ? `, ${state.applied} aplicadas` : ''}.`)
      await mutate()
    } catch (reason) {
      setFailed(true); setMessage(reason instanceof AdminApiError ? reason.message : 'Não foi possível rodar agora.')
    } finally { setBusy(null) }
  }

  async function decide(proposal: Proposal, decision: 'approve' | 'reject') {
    if (decision === 'approve' && !window.confirm(`Aprovar e aplicar agora?\n\n${proposal.title}`)) return
    setBusy(proposal.id); setMessage(''); setFailed(false)
    try {
      const result = await adminFetch<{ status: string; result: { error?: string } | null }>(`/api/v1/admin/engine/proposals/${proposal.id}`, { method: 'POST', body: JSON.stringify({ decision }) })
      if (result.status === 'failed') { setFailed(true); setMessage(`Não foi possível aplicar: ${result.result?.error ?? 'erro desconhecido'}.`) }
      else setMessage(decision === 'approve' ? 'Aprovada e aplicada.' : 'Recusada. A Engine não volta a sugerir isso por 30 dias.')
      await mutate()
    } catch (reason) {
      setFailed(true); setMessage(reason instanceof AdminApiError ? reason.message : 'Não foi possível concluir.')
    } finally { setBusy(null) }
  }

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar a Engine.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  const { state, settings } = data
  const coverage = state?.coverage
  const share = coverage ? Math.min(100, Math.round((coverage.siteViews / Math.max(1, coverage.minSiteViews)) * 100)) : 0
  const list = tab === 'pending' ? data.pending : tab === 'shadow' ? data.shadow : data.history

  return <div className={styles.stack}>
    <section className={`panel ${styles.status}`} aria-labelledby="engine-status">
      <div className={styles.head}>
        <div>
          <h2 id="engine-status">Estado da Engine</h2>
          <p><span className={`${styles.mode} ${styles[`mode_${settings.mode}`]}`}>{modeLabel[settings.mode]}</span>
            {state ? <> · última execução {dateTime(state.at)}</> : ' · ainda não rodou'}</p>
        </div>
        {canRun && <button type="button" className="btn primary" onClick={run} disabled={busy === 'run' || settings.mode === 'off'} aria-busy={busy === 'run'}><Play aria-hidden="true"/> {busy === 'run' ? 'Rodando…' : 'Rodar agora'}</button>}
      </div>
      {message && <p className={failed ? styles.bad : styles.ok} role={failed ? 'alert' : 'status'}>{message}</p>}
      {state?.note && <p className={styles.note}>{state.note}</p>}
      {coverage && <div className={styles.coverage}>
        <div className={styles.coverageText}><strong>{coverage.siteViews.toLocaleString('pt-BR')}</strong> de {coverage.minSiteViews.toLocaleString('pt-BR')} visitas a produtos para a faxina decidir · {coverage.eligible} candidatos · {coverage.activeProducts} produtos ativos</div>
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-label="Dados disponíveis para a faxina"><span style={{ width: `${share}%` }}/></div>
      </div>}
      <p className={styles.help}>A Engine nunca apaga nada: tirar da vitrine é arquivar e travar o produto, e dá para reverter em Produtos. Só visitantes que permitiram a medição contam como visita.</p>
    </section>

    <section className="panel" aria-labelledby="engine-queue">
      <h2 id="engine-queue">Sugestões</h2>
      <div className={styles.tabs} role="tablist" aria-label="Sugestões da Engine">
        {([['pending', `Aguardando você (${data.pending.length})`], ['shadow', `Sombra (${data.shadow.length})`], ['history', 'Histórico']] as [Tab, string][]).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? styles.tabActive : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'shadow' && <p className={styles.help}>No modo sombra a Engine só registra o que faria. Compare com o que você faria sozinho; quando concordar, mude o modo para “Com aprovação”.</p>}
      {list.length === 0
        ? <p className={styles.empty}>{tab === 'pending' ? 'Nada aguardando. Quando a Engine tiver sugestões que pedem o seu OK, elas aparecem aqui.' : tab === 'shadow' ? 'Nenhum registro no modo sombra.' : 'Nada decidido ainda.'}</p>
        : <ul className={styles.list}>{list.map((proposal) => <li key={proposal.id} className={styles.item}>
          <div className={styles.itemMain}>
            <span className={styles.kind}>{proposal.kindLabel}</span>
            <strong>{proposal.title}</strong>
            <p>{proposal.reason}</p>
            <ul className={styles.evidence} aria-label="Números que justificam">
              {Object.entries(proposal.evidence).filter(([key]) => key in evidenceLabels).map(([key, value]) => <li key={key}><strong>{String(value)}</strong> {evidenceLabels[key]}</li>)}
            </ul>
            <small>{statusLabel[proposal.status] ?? proposal.status} · sugerida em {dateTime(proposal.createdAt)}{proposal.decidedAt ? ` · decidida em ${dateTime(proposal.decidedAt)}` : ''}{proposal.status === 'failed' && proposal.result && 'error' in proposal.result ? ` · ${String(proposal.result.error)}` : ''}</small>
          </div>
          {proposal.status === 'pending' && canDecide && <div className={styles.actions}>
            <button type="button" className="btn primary" disabled={busy === proposal.id} onClick={() => decide(proposal, 'approve')}><Check aria-hidden="true"/> Aprovar</button>
            <button type="button" className="btn secondary" disabled={busy === proposal.id} onClick={() => decide(proposal, 'reject')}><X aria-hidden="true"/> Recusar</button>
          </div>}
        </li>)}</ul>}
    </section>

    <details className={styles.settings}>
      <summary>Ajustes da Engine</summary>
      <SettingsForm settingKey="engine"/>
    </details>
  </div>
}
