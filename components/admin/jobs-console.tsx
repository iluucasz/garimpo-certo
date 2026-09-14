'use client'

import { useEffect, useState } from 'react'
import { Check, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { platformServices, type JobRun } from '@/lib/platform'

const STORAGE_KEY = 'garimpo:job-runs'

function readRuns(): JobRun[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as JobRun[] } catch { return [] }
}

export function JobsConsole() {
  const [runs, setRuns] = useState<JobRun[]>([])
  const [message, setMessage] = useState('')
  useEffect(() => setRuns(readRuns()), [])

  function persist(next: JobRun[]) { setRuns(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  async function start(key: string) {
    const adapter = platformServices.adapters.find((item) => item.key === key)
    if (!adapter) return
    const run = await adapter.sync()
    persist([run, ...runs])
    platformServices.tracker.track({ name: 'provider_sync_started', resource: 'job', resourceId: run.id, actor: 'Marina' })
    setMessage(`Sincronização de ${adapter.name} iniciada.`)
  }
  function advance(run: JobRun) {
    const progress = Math.min(100, run.progress + 32)
    const next = runs.map((item) => item.id === run.id ? { ...item, progress, processed: item.processed + 120, status: progress === 100 ? 'completed' as const : 'running' as const } : item)
    persist(next)
    setMessage(progress === 100 ? 'Job concluído e auditado.' : 'Novo lote processado.')
  }
  function retry(run: JobRun) {
    const next = runs.map((item) => item.id === run.id ? { ...item, progress: 5, errors: 0, status: 'running' as const, startedAt: new Date().toISOString() } : item)
    persist(next); setMessage('Job reiniciado com idempotência simulada.')
  }

  return <div className="jobs-console"><div className="panel"><div className="section-heading"><div><div className="kicker">PROVIDER ADAPTERS</div><h2>Executar sincronização</h2></div></div><div className="adapter-grid">{platformServices.adapters.map((adapter) => <button className="adapter-card" onClick={() => start(adapter.key)} key={adapter.key}><RefreshCw/><strong>{adapter.name}</strong><span>Iniciar sync</span></button>)}</div></div><div className="panel"><h2>Execuções locais</h2>{runs.length ? runs.map((run) => <div className="job-run" key={run.id}><div><strong>{run.job}</strong><small>{run.provider} · {run.processed} processados · {run.errors} erros</small></div><div className="job-progress"><span style={{ width: `${run.progress}%` }}/></div><strong>{run.progress}%</strong>{run.status === 'completed' ? <span className="status"><Check/> Concluído</span> : run.status === 'failed' ? <button className="btn secondary" onClick={() => retry(run)}><RotateCcw/> Repetir</button> : <button className="btn secondary" onClick={() => advance(run)}><Play/> Processar lote</button>}</div>) : <div className="empty-state compact"><RefreshCw/><h2>Nenhum job executado</h2><p>Inicie uma sincronização acima.</p></div>}</div>{message && <div className="toast" role="status"><Check/> {message}</div>}</div>
}
