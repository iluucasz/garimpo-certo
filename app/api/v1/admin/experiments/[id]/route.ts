import { and, eq, ne, sql } from 'drizzle-orm'
import { recordAudit } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { invalidate } from '@/lib/db/invalidate'
import { abExperiments } from '@/lib/db/schema'
import { EXPERIMENT_TAG, getExperiment } from '@/lib/db/repositories/experiments'
import { getEditorState, saveDraft } from '@/lib/db/repositories/site-documents'
import type { VariantCopy } from '@/lib/experiments/core'
import { applyHeroCopy } from '@/lib/site-builder/document'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ações de um teste. `start`: põe em andamento (só um por vez); `stop`: encerra, com `winner` opcional ('a' | 'b');
 * `apply`: copia os textos da variante B para o rascunho da home (você confere e publica em Painel → Home).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const { id } = await params
  if (!uuid.test(id)) return fail('Teste não encontrado.', 404)
  const row = await getExperiment(id)
  if (!row) return fail('Teste não encontrado.', 404)
  const body = await jsonBody<{ action?: string; winner?: string }>(request)

  if (body?.action === 'start') {
    if (row.status === 'running') return fail('O teste já está em andamento.', 409)
    if (row.status === 'stopped') return fail('Este teste já terminou. Crie outro para medir de novo.', 409)
    const [other] = await db.select({ name: abExperiments.name }).from(abExperiments).where(and(eq(abExperiments.status, 'running'), ne(abExperiments.id, id))).limit(1)
    if (other) return fail(`Já existe um teste em andamento (“${other.name}”). Pare-o antes de iniciar outro.`, 409)
    await db.update(abExperiments).set({ status: 'running', startedAt: sql`now()`, stoppedAt: null }).where(eq(abExperiments.id, id))
  } else if (body?.action === 'stop') {
    if (row.status !== 'running') return fail('O teste não está em andamento.', 409)
    const winner = body.winner === 'a' || body.winner === 'b' ? body.winner : null
    await db.update(abExperiments).set({ status: 'stopped', stoppedAt: sql`now()`, winner }).where(eq(abExperiments.id, id))
  } else if (body?.action === 'apply') {
    const copy = row.variantB as VariantCopy
    const state = await getEditorState('home')
    await saveDraft('home', applyHeroCopy(state.document, copy), userId)
    await db.update(abExperiments).set({ winner: row.winner ?? 'b' }).where(eq(abExperiments.id, id))
    await recordAudit({ actorUserId: userId, action: 'experiments.apply', entityType: 'teste', entityId: id, after: { key: row.key } })
    return ok({ id, applied: true })
  } else {
    return fail('Ação inválida.', 422)
  }

  await recordAudit({ actorUserId: userId, action: `experiments.${body.action}`, entityType: 'teste', entityId: id, after: { key: row.key, winner: body.winner ?? null } })
  invalidate(EXPERIMENT_TAG)
  return ok({ id, action: body.action })
}
