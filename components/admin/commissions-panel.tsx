'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { formatPrice } from '@/lib/format'
import type { CommissionReport } from '@/lib/db/repositories/commissions'
import { useAdminAccess } from './admin-access'
import styles from './resource.module.css'

const number = new Intl.NumberFormat('pt-BR')
const windows = [{ days: 7, label: '7 dias' }, { days: 30, label: '30 dias' }, { days: 60, label: '60 dias' }, { days: 89, label: '89 dias' }]

const channelLabel: Record<string, string> = { site: 'Site', telegram: 'Telegram', whatsapp: 'WhatsApp', instagram: 'Instagram', tiktok: 'TikTok', 'sem-origem': 'Sem origem' }

/** Comissões reais da Shopee: o que é previsto, o que já foi confirmado, e de onde vem (canal, categoria e produto). */
export function CommissionsPanel() {
  const { permissions } = useAdminAccess()
  const canSync = permissions.includes('jobs:run')
  const [days, setDays] = useState(30)
  const { data, error, mutate } = useSWR<CommissionReport>(`/api/v1/admin/commissions?days=${days}`, swrFetcher, { revalidateOnFocus: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function sync() {
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      const result = await adminFetch<{ fetched: number; created: number; updated: number; unchanged: number; windowDays: number }>('/api/v1/admin/conversions-sync', { method: 'POST' })
      setMessage(`${result.fetched} conversões lidas na Shopee (últimos ${result.windowDays} dias): ${result.created} novas, ${result.updated} atualizadas, ${result.unchanged} sem mudança.`)
      await mutate()
    } catch (reason) {
      setFailed(true)
      setMessage(reason instanceof AdminApiError ? reason.message : 'Falha ao sincronizar.')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <section className="panel"><p className={styles.error} role="alert">Não foi possível carregar as comissões.</p></section>
  if (!data) return <section className="panel" role="status">Carregando comissões…</section>

  const { totals } = data
  const confirmed = totals.approved.commission + totals.paid.commission
  const sync_ = data.lastSync

  return <section className={styles.stack} aria-label="Comissões reais da Shopee">
    <div className="panel">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Comissões reais (Shopee)</h2>
          <p className={styles.help}>
            {sync_.at
              ? <>Última sincronização: {dateTime(sync_.at)}{sync_.status === 'failed' ? <> — <strong>falhou</strong>{sync_.error ? `: ${sync_.error}` : ''}</> : ''}.</>
              : 'Ainda não sincronizado. O worker da VPS sincroniza a cada 3 horas; você também pode sincronizar agora.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select aria-label="Período" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {windows.map((item) => <option key={item.days} value={item.days}>Últimos {item.label}</option>)}
          </select>
          {canSync && <button type="button" className="btn secondary" onClick={sync} disabled={busy} aria-busy={busy}>
            <RefreshCw className={busy ? 'spin' : undefined} aria-hidden="true"/> {busy ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>}
        </div>
      </div>
      {message && <p className={`${styles.note} ${failed ? styles.warn : ''}`} role={failed ? 'alert' : 'status'} style={{ marginTop: 12 }}>{message}</p>}
    </div>

    <div className="stat-grid">
      <div className="stat-card"><span>Conversões</span><strong>{number.format(totals.conversions)}</strong><small>{number.format(totals.lost.count)} canceladas ou rejeitadas</small></div>
      <div className="stat-card"><span>Comissão prevista</span><strong>{formatPrice(totals.pending.commission)}</strong><small>{number.format(totals.pending.count)} pedidos ainda sem conclusão</small></div>
      <div className="stat-card"><span>Comissão confirmada</span><strong>{formatPrice(confirmed)}</strong><small>pedidos concluídos, inclusive os já pagos</small></div>
      <div className="stat-card"><span>Vendas geradas</span><strong>{formatPrice(totals.pending.amount + totals.approved.amount + totals.paid.amount)}</strong><small>valor dos pedidos, sem cancelados</small></div>
    </div>

    {totals.conversions === 0 && <div className="panel">
      <p className={styles.lead}>Nenhuma conversão neste período.</p>
    </div>}

    {data.byOrigin.length > 0 && <div className="panel">
      <h2>De onde vem a comissão</h2>
      <div className="table-scroll"><table className="data-table" aria-label="Comissão por origem">
        <thead><tr><th scope="col">Canal</th><th scope="col">Categoria / campanha</th><th scope="col">Conversões</th><th scope="col">Vendas</th><th scope="col">Comissão</th></tr></thead>
        <tbody>{data.byOrigin.map((row) => <tr key={`${row.channel}-${row.detail ?? ''}`}>
          <td>{channelLabel[row.channel] ?? row.channel}</td><td>{row.detail ?? '—'}</td>
          <td>{number.format(row.conversions)}</td><td>{formatPrice(row.amount)}</td><td>{formatPrice(row.commission)}</td>
        </tr>)}</tbody>
      </table></div>
      
    </div>}

    {data.byProduct.length > 0 && <div className="panel">
      <h2>Produtos que mais renderam</h2>
      <div className="table-scroll"><table className="data-table" aria-label="Comissão por produto">
        <thead><tr><th scope="col">Produto</th><th scope="col">Pedidos</th><th scope="col">Unidades</th><th scope="col">Vendas</th><th scope="col">Comissão</th></tr></thead>
        <tbody>{data.byProduct.map((row) => <tr key={row.productId}>
          <td><a href={`/produto/${row.slug}`} target="_blank" rel="noreferrer noopener">{row.name}</a></td>
          <td>{number.format(row.conversions)}</td><td>{number.format(row.quantity)}</td><td>{formatPrice(row.amount)}</td><td>{formatPrice(row.commission)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </section>
}
