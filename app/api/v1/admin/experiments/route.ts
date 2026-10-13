import { eq } from 'drizzle-orm'
import { recordAudit } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { invalidate } from '@/lib/db/invalidate'
import { abExperiments } from '@/lib/db/schema'
import { EXPERIMENT_TAG, listExperiments } from '@/lib/db/repositories/experiments'
import { normalizeVariantB, slugifyKey } from '@/lib/experiments/core'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

const view = ({ row, results }: Awaited<ReturnType<typeof listExperiments>>[number]) => ({
  id: row.id, key: row.key, name: row.name, hypothesis: row.hypothesis, status: row.status, variantB: row.variantB, splitB: row.splitB,
  winner: row.winner, startedAt: row.startedAt, stoppedAt: row.stoppedAt, createdAt: row.createdAt, results,
})

/** Testes A/B do topo da home, com o resultado de cada um. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  return ok({ experiments: (await listExperiments()).map(view) })
}

/** Cria um teste em rascunho. Corpo: `{ name, hypothesis?, variantB: { title, accent, text, buttonLabel }, splitB? }`. */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const body = await jsonBody<{ name?: string; hypothesis?: string; variantB?: unknown; splitB?: number }>(request)
  const errors: Record<string, string> = {}
  const name = (body?.name ?? '').trim().slice(0, 80)
  if (!name) errors.name = 'Dê um nome ao teste.'
  const variant = normalizeVariantB(body?.variantB)
  if ('errors' in variant) Object.assign(errors, Object.fromEntries(Object.entries(variant.errors).map(([key, value]) => [`variantB.${key}`, value])))
  const split = Number(body?.splitB ?? 50)
  if (!Number.isFinite(split) || split < 10 || split > 90) errors.splitB = 'Use entre 10% e 90%.'
  if (Object.keys(errors).length) return fail('Revise os campos destacados.', 422, errors)

  const key = `${slugifyKey(name) || 'teste'}-${Date.now().toString(36).slice(-4)}`
  const [created] = await db.insert(abExperiments).values({
    key, name, hypothesis: (body?.hypothesis ?? '').trim().slice(0, 300) || null,
    variantB: (variant as { value: object }).value, splitB: Math.round(split), createdBy: userId,
  }).returning()
  await recordAudit({ actorUserId: userId, action: 'experiments.create', entityType: 'teste', entityId: created.id, after: { key } })
  invalidate(EXPERIMENT_TAG)
  return ok({ id: created.id, key }, { status: 201 })
}

export async function DELETE(request: Request) {
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const [row] = await db.select().from(abExperiments).where(eq(abExperiments.id, id)).limit(1)
  if (!row) return fail('Teste não encontrado.', 404)
  if (row.status !== 'draft') return fail('Só testes em rascunho podem ser apagados. Pare e mantenha o histórico.', 409)
  await db.delete(abExperiments).where(eq(abExperiments.id, id))
  await recordAudit({ actorUserId: userId, action: 'experiments.delete', entityType: 'teste', entityId: id, before: { key: row.key } })
  invalidate(EXPERIMENT_TAG)
  return ok({ id })
}
