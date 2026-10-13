import { recordAudit } from '@/lib/admin/audit'
import { invalidate } from '@/lib/db/invalidate'
import { runEngine } from '@/lib/engine/run'
import { kindLabels, listProposals, loadEngineSettings, proposalCounts, readRunState } from '@/lib/engine/store'
import { authorize, fail, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const view = (row: Awaited<ReturnType<typeof listProposals>>[number]) => ({
  id: row.id, kind: row.kind, kindLabel: kindLabels[row.kind] ?? row.kind, subjectType: row.subjectType, subjectId: row.subjectId,
  title: row.title, reason: row.reason, evidence: row.evidence, status: row.status, createdAt: row.createdAt,
  decidedAt: row.decidedAt, decisionNote: row.decisionNote, expiresAt: row.expiresAt, result: row.result,
})

/** Estado da Engine: modo, última execução, contagens e as propostas (aguardando, sombra e histórico). */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const [settings, state, counts, open, history] = await Promise.all([
    loadEngineSettings(), readRunState(), proposalCounts(),
    listProposals({ statuses: ['pending', 'shadow'], limit: 200 }),
    listProposals({ statuses: ['applied', 'rejected', 'failed', 'expired'], limit: 50 }),
  ])
  return ok({
    settings, state, counts,
    pending: open.filter((row) => row.status === 'pending').map(view),
    shadow: open.filter((row) => row.status === 'shadow').map(view),
    history: history.map(view),
  })
}

/** Roda a Engine agora (a mesma execução do worker). Exige `jobs:run`. */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'jobs:run')
  if (blocked) return blocked
  try {
    const state = await runEngine()
    invalidate('catalog')
    await recordAudit({ actorUserId: userId, action: 'engine.run', entityType: 'engine', entityId: 'run', after: { mode: state.mode, created: state.created, applied: state.applied } })
    return ok(state)
  } catch (error) {
    console.error('[engine] falha na execução', error)
    return fail('Falha ao rodar a Engine.', 500)
  }
}
