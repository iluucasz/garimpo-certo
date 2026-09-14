'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Filter, Link2 } from 'lucide-react'
import { formatPrice } from '@/lib/mock-data'
import type { ConversionStatus } from '@/lib/analytics/attribution'

type Provider = { id: string; code: string; displayName: string }
type AttributionReport = {
  clicks: unknown[]
  conversions: { id: string; providerConversionId: string; clickId: string | null; providerId: string; orderReferenceHash: string; amount: string; commission: string; status: string }[]
  metrics: { clicks: number; validClicks: number; conversions: number; conversionRate: number; estimatedCommission: number; approvedCommission: number; paidCommission: number; invalidTraffic: number }
  funnel: { name: string; value: number }[]
  quality: { highRisk: unknown[]; mediumRisk: unknown[]; unattributed: number }
}

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

  return <section className="analytics-studio"><div className="analytics-filters"><span><Filter/> Filtros de atribuição</span><select aria-label="Provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}><option value="">Todos providers</option>{providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.displayName}</option>)}</select><select aria-label="Slot" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Todos slots</option><option>home_trending</option><option>home_for_you</option><option>product_similar</option></select><select aria-label="Status da conversão" value={status} onChange={(e) => setStatus(e.target.value as '' | ConversionStatus)}><option value="">Todos status</option><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="paid">Paga</option><option value="rejected">Rejeitada</option></select><button className="btn secondary" onClick={exportReport}><Download/> Exportar</button></div><div className="attribution-stats"><Metric label="Cliques válidos" value={`${report.metrics.validClicks}`} note={`${report.metrics.invalidTraffic} bloqueados`}/><Metric label="Conversões" value={`${report.metrics.conversions}`} note={`${(report.metrics.conversionRate * 100).toFixed(1)}% dos cliques`}/><Metric label="Comissão estimada" value={formatPrice(report.metrics.estimatedCommission)} note="inclui pendentes"/><Metric label="Comissão aprovada" value={formatPrice(report.metrics.approvedCommission)} note="aprovadas + pagas"/><Metric label="Comissão paga" value={formatPrice(report.metrics.paidCommission)} note="receita realizada"/></div><div className="attribution-grid"><div className="panel"><h2>{mode === 'funil' ? 'Funil de atribuição' : 'Clique → conversão → comissão'}</h2><div className="funnel-viz">{report.funnel.map((item, index) => <div key={item.name}><span>{item.name}</span><i style={{ width: `${Math.max(8, item.value / max * 100)}%` }}/><strong>{item.value}</strong>{index < report.funnel.length - 1 && <small>{Math.round(report.funnel[index + 1].value / Math.max(item.value, 1) * 100)}% avançam</small>}</div>)}</div></div><div className="panel"><h2>Qualidade de tráfego</h2><div className="quality-score"><strong>{Math.round((1 - report.metrics.invalidTraffic / Math.max(report.metrics.clicks, 1)) * 100)}</strong><span>score de confiança</span></div><div className="risk-row"><AlertTriangle/><span><strong>{report.quality.highRisk.length} sinais de alto risco</strong><small>Detecção de fraude ainda não implementada nesta fase.</small></span></div><div className="risk-row"><Link2/><span><strong>{report.quality.unattributed} conversões sem clique</strong><small>Requerem conciliação por referência do provider.</small></span></div></div></div><div className="panel attribution-table"><h2>Ledger de conversões</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Conversão</th><th>Clique</th><th>Provider</th><th>Pedido hash</th><th>Valor</th><th>Comissão</th><th>Status</th></tr></thead><tbody>{report.conversions.map((item) => <tr key={item.id}><td>{item.providerConversionId}</td><td>{item.clickId}</td><td>{item.providerId}</td><td><code>{item.orderReferenceHash}</code></td><td>{formatPrice(Number(item.amount))}</td><td>{formatPrice(Number(item.commission))}</td><td><span className="status">{item.status}</span></td></tr>)}</tbody></table></div></div></section>
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }
