'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { useAdminAccess } from './admin-access'

type Result = { created: number; updated: number; priceChanges: number; selected: number; archived: number; prunedSkipped: boolean; durationMs: number }

export function CatalogImportButton({ onDone }: { onDone?: () => void }) {
  const router = useRouter()
  const { allowed } = useAdminAccess()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  if (!allowed('imports-jobs', true)) return <p role="note">Seu papel não permite importar. Peça a um administrador.</p>

  async function run() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/v1/admin/catalog-import', { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error?.message ?? 'Falha ao importar.')
      setResult(body.data as Result)
      router.refresh()
      onDone?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao importar.')
    } finally {
      setBusy(false)
    }
  }

  return <div>
    <button type="button" className="btn primary" onClick={run} disabled={busy} aria-busy={busy}><RefreshCw className={busy ? 'spin' : undefined} aria-hidden="true"/>{busy ? 'Importando (1 a 2 min)…' : 'Importar da Shopee agora'}</button>
    {error && <p role="alert" style={{ marginTop: 12, color: 'var(--primary)' }}>{error}</p>}
    {result && <p role="status" style={{ marginTop: 12 }}><Check aria-hidden="true" style={{ verticalAlign: '-2px' }}/> {result.created} novos, {result.updated} atualizados, {result.priceChanges} com preço novo no histórico
      {result.archived > 0 ? `, ${result.archived} arquivados` : ''}{result.prunedSkipped ? ' (arquivamento ignorado: a importação cobriu pouco do catálogo atual)' : ''}. Levou {Math.round(result.durationMs / 1000)} s.</p>}
  </div>
}
