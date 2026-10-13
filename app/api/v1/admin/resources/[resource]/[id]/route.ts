import { guardResource, revalidateFor } from '@/lib/admin/guard'
import { recordAudit } from '@/lib/admin/audit'
import { validateResource } from '@/lib/admin/validate'
import { fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ resource: string; id: string }> }

export async function GET(request: Request, { params }: Context) {
  const { resource, id } = await params
  const guard = await guardResource(request, resource, 'read')
  if ('blocked' in guard) return guard.blocked
  const row = await guard.handler.get(id)
  return row ? ok(row) : fail('Registro não encontrado.', 404)
}

export async function PATCH(request: Request, { params }: Context) {
  const { resource, id } = await params
  const guard = await guardResource(request, resource, 'write')
  if ('blocked' in guard) return guard.blocked
  if (!guard.handler.update) return fail('Este recurso não aceita edição.', 405)
  const body = await jsonBody<unknown>(request)
  if (body === null) return fail('Corpo da requisição inválido.', 400)
  const { values, errors } = validateResource(guard.meta, body, 'update')
  if (Object.keys(errors).length) return fail('Revise os campos destacados.', 422, errors)
  const before = await guard.handler.get(id)
  if (!before) return fail('Registro não encontrado.', 404)
  const result = await guard.handler.update(id, values, guard.userId)
  if (!result) return fail('Registro não encontrado.', 404)
  if ('errors' in result) return fail(Object.values(result.errors)[0] ?? 'Não foi possível salvar.', result.status ?? 422, result.errors)
  await recordAudit({ actorUserId: guard.userId, action: `${resource}.update`, entityType: guard.meta.singular, entityId: id, before, after: result.row })
  revalidateFor(guard.handler)
  return ok(result.row)
}

export async function DELETE(request: Request, { params }: Context) {
  const { resource, id } = await params
  const guard = await guardResource(request, resource, 'write')
  if ('blocked' in guard) return guard.blocked
  if (!guard.meta.remove || !guard.handler.remove) return fail('Este recurso não aceita exclusão.', 405)
  const result = await guard.handler.remove(id)
  if (!result) return fail('Registro não encontrado.', 404)
  if ('error' in result) return fail(result.error, result.status)
  await recordAudit({ actorUserId: guard.userId, action: `${resource}.${guard.meta.remove === 'archive' ? 'archive' : 'delete'}`, entityType: guard.meta.singular, entityId: id, before: result.before })
  revalidateFor(guard.handler)
  return ok({ id, removed: true })
}
