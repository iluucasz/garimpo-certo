import { recordAudit } from '@/lib/admin/audit'
import { invalidate } from '@/lib/db/invalidate'
import { decideProposal } from '@/lib/engine/store'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Aprova (e aplica) ou recusa uma proposta. Corpo: `{ decision: 'approve' | 'reject', note? }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { blocked, userId } = await authorize(request, 'catalog:write')
  if (blocked) return blocked
  const { id } = await params
  if (!uuid.test(id)) return fail('Proposta não encontrada.', 404)
  const body = await jsonBody<{ decision?: string; note?: string }>(request)
  if (body?.decision !== 'approve' && body?.decision !== 'reject') return fail('Decisão inválida.', 422)

  const result = await decideProposal(id, body.decision, userId, typeof body.note === 'string' ? body.note : undefined)
  if ('error' in result) return fail(result.error, result.status)
  if (result.invalidate.length) invalidate(...result.invalidate)
  await recordAudit({ actorUserId: userId, action: `engine.proposal.${body.decision}`, entityType: 'proposta', entityId: id, after: { status: result.row.status, kind: result.row.kind } })
  return ok({ id, status: result.row.status, result: result.row.result })
}
