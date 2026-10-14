'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { formatPrice } from '@/lib/format'
import type { ConversionStatus } from '@/lib/analytics/attribution'
import { CommissionsPanel } from './commissions-panel'
import styles from './resource.module.css'

type Provider = { id: string; code: string; displayName: string }
type AttributionReport = {
  clicks: unknown[]
  conversions: { id: string; providerConversionId: string; clickId: string | null; subIds: string | null; providerId: string; orderReferenceHash: string; amount: string; commission: string; status: string }[]
  metrics: { clicks: number; validClicks: number; conversions: number; conversionRate: number; estimatedCommission: number; approvedCommission: number; paidCommission: number; invalidTraffic: number }
  funnel: { name: string; value: number }[]
  quality: { highRisk: unknown[]; mediumRisk: unknown[]; unattributed: number }
}

const statusLabel: Record<string, string> = { pending: 'Pendente', approved: 'Aprovada', paid: 'Paga', rejected: 'Rejeitada', cancelled: 'Cancelada' }

/**
 * Analytics: comissões reais + resumo dos cliques. Funil: do clique à conversão.
 * As comissões ficam só no painel de comissões (antes havia uma segunda fileira de números repetidos aqui).
 * Filtros e ledger ficam recolhidos: a maioria das visitas ao painel só quer o resumo.
 */
export function AnalyticsStudio({ mode }: { mode: 'analytics' | 'funil' }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [providerId, setProviderId] = useState(''); const [slot, setSlot] = useState(''); const [status, setStatus] = useState<'' | ConversionStatus>('')
  const [report, setReport] = useState<AttributionReport | null>(null)

  useEffect(() => { fetch('/api/v1/providers').then((r) => r.ok ? r.json() : null).then((body) => setProviders(body?.data ?? [])) }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (providerId) params.set('providerId', providerId)
    if (slot) params.set('slot', slot)
    if (status) params.set('status', status)
    fetch(`/api/v1/attribution?${params}`).then((r) => r.ok ? r.json() : null).then((body) => setReport(body?.data ?? null))
  }, [providerId, slot, status])

  const max = useMemo(() => Math.max(...(report?.funnel.map((item) => item.value) ?? [1]), 1), [report])
  function exportReport() { if (!report) return; const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'attribution-report.json'; link.click(); URL.revokeObjectURL(url) }

  if (!report) return <section className="analytics-studio"><p>Carregando…</p></section>

  const { metrics, quality } = report
  const trust = Math.round((1 - metrics.invalidTraffic / Math.max(metrics.clicks, 1)) * 100)
  const filtered = Boolean(providerId || slot || status)

  const filters = <details className={`panel ${styles.collapse}`} open={filtered}>
    <summary><span>Filtrar e exportar</span><small>{filtered ? 'filtro ativo' : 'por provedor, posição no site ou situação'}</small></summary>
    <div className="analytics-filters" style={{ border: 0, padding: 0 }}>
      <select aria-label="Provedor" value={providerId} onChange={(e) => setProviderId(e.target.value)}><option value="">Todos os provedores</option>{providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.displayName}</option>)}</select>
      <select aria-label="Posição no site" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Todas as posições</option><option value="home_trending">Home: em alta</option><option value="home_for_you">Home: para você</option><option value="product_similar">Produto: parecidos</option></select>
      <select aria-label="Situação da conversão" value={status} onChange={(e) => setStatus(e.target.value as '' | ConversionStatus)}><option value="">Todas as situações</option><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="paid">Paga</option><option value="rejected">Rejeitada</option></select>
      <button className="btn secondary" onClick={exportReport}><Download aria-hidden="true"/> Exportar</button>
    </div>
  </details>

  const funnel = <div className="panel">
    <h2>{mode === 'funil' ? 'Do clique à conversão' : 'Cliques que viraram venda'}</h2>
    <p className={styles.help} style={{ marginBottom: 14 }}>
      {metrics.validClicks === 0
        ? 'Ainda não há cliques de compra medidos neste recorte. Só entram visitas que aceitaram a medição.'
        : <>{metrics.validClicks.toLocaleString('pt-BR')} {metrics.validClicks === 1 ? 'clique válido gerou' : 'cliques válidos geraram'} {metrics.conversions.toLocaleString('pt-BR')} {metrics.conversions === 1 ? 'conversão' : 'conversões'} ({(metrics.conversionRate * 100).toFixed(1)}%).{metrics.invalidTraffic > 0 ? ` ${metrics.invalidTraffic.toLocaleString('pt-BR')} cliques foram bloqueados.` : ''}</>}
    </p>
    <div className="funnel-viz">{report.funnel.map((item, index) => <div key={item.name}><span>{item.name}</span><i style={{ width: `${Math.max(8, item.value / max * 100)}%` }}/><strong>{item.value}</strong>{index < report.funnel.length - 1 && <small>{Math.round(report.funnel[index + 1].value / Math.max(item.value, 1) * 100)}% avançam</small>}</div>)}</div>
  </div>

  const trafficQuality = <div className="panel">
    <h2>Qualidade do tráfego</h2>
    <div className="quality-score"><strong>{trust}</strong><span>pontos de confiança (máx. 100)</span></div>
    <p className={styles.help} style={{ marginTop: 12 }}>
      {quality.unattributed > 0
        ? `${quality.unattributed.toLocaleString('pt-BR')} conversões sem origem: compras de links sem etiqueta (anteriores às etiquetas do site ou gerados fora dele).`
        : 'Todas as conversões têm origem conhecida.'}
      {quality.highRisk.length > 0 ? ` ${quality.highRisk.length} sinais de alto risco.` : ''}
    </p>
  </div>

  const ledger = <details className={`panel ${styles.collapse}`} open={report.conversions.length > 0 && report.conversions.length <= 8}>
    <summary><span>Conversões registradas</span><small>{report.conversions.length === 0 ? 'nenhuma ainda' : `${report.conversions.length} no recorte`}</small></summary>
    {report.conversions.length === 0
      ? <p className={styles.help}>Quando a Shopee confirmar vendas feitas pelos seus links, elas aparecem aqui.</p>
      : <div className="table-scroll attribution-table"><table className="data-table"><thead><tr><th>Conversão</th><th>Origem</th><th>Valor</th><th>Comissão</th><th>Situação</th></tr></thead><tbody>{report.conversions.map((item) => <tr key={item.id}><td>{item.providerConversionId}</td><td>{item.subIds ?? item.clickId ?? '—'}</td><td>{formatPrice(Number(item.amount))}</td><td>{formatPrice(Number(item.commission))}</td><td><span className="status">{statusLabel[item.status] ?? item.status}</span></td></tr>)}</tbody></table></div>}
  </details>

  return <section className="analytics-studio">
    {mode === 'analytics' && <CommissionsPanel/>}
    {mode === 'funil' && <div className="stat-grid">
      <div className="stat-card"><span>Cliques válidos</span><strong>{metrics.validClicks.toLocaleString('pt-BR')}</strong><small>{metrics.invalidTraffic.toLocaleString('pt-BR')} bloqueados</small></div>
      <div className="stat-card"><span>Conversões</span><strong>{metrics.conversions.toLocaleString('pt-BR')}</strong><small>{(metrics.conversionRate * 100).toFixed(1)}% dos cliques</small></div>
      <div className="stat-card"><span>Comissão estimada</span><strong>{formatPrice(metrics.estimatedCommission)}</strong><small>inclui pendentes</small></div>
    </div>}
    {mode === 'funil' ? <div className="attribution-grid">{funnel}{trafficQuality}</div> : funnel}
    {filters}
    {ledger}
  </section>
}
