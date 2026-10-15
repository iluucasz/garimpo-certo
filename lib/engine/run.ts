import { closeRun, openRun } from '@/lib/providers/shopee/job-runs'
import { expireStale, importerKeywords, loadCategoryStats, loadEngineSettings, loadSignals, persistDrafts, saveRunState, applyProposal, AUTO_KINDS, type RunState } from './store'
import { pruneProposals, quotaProposals, seasonalProposals, type EngineConfig, type ProposalDraft } from './rules'
import { engineProposals } from '@/lib/db/schema'
import { db } from '@/lib/db/client'
import { and, eq, inArray } from 'drizzle-orm'

export const ENGINE_JOB_TYPE = 'engine_run'

let running: Promise<RunState> | null = null

const todayInSaoPaulo = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

async function execute(now: Date): Promise<RunState> {
  const settings = await loadEngineSettings()
  const base: RunState = { at: now.toISOString(), mode: settings.mode, created: 0, refreshed: 0, expired: 0, applied: 0, note: null, coverage: null }
  if (settings.mode === 'off') {
    const state = { ...base, note: 'A Engine está desligada.' }
    await saveRunState(state)
    return state
  }
  const runId = await openRun(ENGINE_JOB_TYPE, '30 6 * * *')
  try {
    const config: EngineConfig = settings
    const { signals, siteViews } = await loadSignals(config.windowDays)
    const prune = pruneProposals(signals, siteViews, config, now.getTime())
    const seasonal = seasonalProposals(todayInSaoPaulo(now), config, importerKeywords())
    // Aprender com os cliques: uma falha na leitura das categorias não pode derrubar a faxina nem o radar.
    const quota = await loadCategoryStats(config.windowDays).then((stats) => quotaProposals(stats, config, now.getTime()))
      .catch(() => ({ proposals: [] as ProposalDraft[], note: null as string | null }))

    const expired = await expireStale(now)
    const persisted = await persistDrafts([...prune.proposals, ...seasonal, ...quota.proposals], settings.mode, now.getTime())

    // Automático: só os tipos reversíveis. O resto continua esperando a equipe.
    let applied = 0
    if (settings.mode === 'auto') {
      const pending = await db.select().from(engineProposals).where(and(eq(engineProposals.status, 'pending'), inArray(engineProposals.kind, [...AUTO_KINDS])))
      for (const row of pending) {
        const result = await applyProposal(row, null)
        await db.update(engineProposals).set(result.ok
          ? { status: 'applied', decidedAt: now.toISOString(), appliedAt: now.toISOString(), decisionNote: 'Aplicada automaticamente (modo automático).', result: result.result }
          : { status: 'failed', decidedAt: now.toISOString(), result: { error: result.error } }).where(eq(engineProposals.id, row.id))
        if (result.ok) applied++
      }
    }

    const notes = [prune.note, seasonal.length === 0 && config.seasonalEnabled ? 'Nenhuma data comercial nova pede termos agora.' : null, quota.note].filter(Boolean)
    const state: RunState = { ...base, created: persisted.created, refreshed: persisted.refreshed, expired, applied, note: notes.join(' ') || null, coverage: prune.coverage }
    await saveRunState(state)
    await closeRun(runId, { status: 'succeeded', processed: signals.length, created: persisted.created, updated: persisted.refreshed, rejected: expired }, ENGINE_JOB_TYPE)
    return state
  } catch (error) {
    await closeRun(runId, { status: 'failed', error: error instanceof Error ? error.message : String(error) }, ENGINE_JOB_TYPE)
    throw error
  }
}

/** Uma execução por vez por instância (worker + botão do painel compartilham o resultado). */
export function runEngine(now = new Date()): Promise<RunState> {
  if (!running) running = execute(now).finally(() => { running = null })
  return running
}
