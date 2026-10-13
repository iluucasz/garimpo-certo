import { guardResource, parseListParams, revalidateFor } from '@/lib/admin/guard'
import { recordAudit } from '@/lib/admin/audit'
import { validateResource } from '@/lib/admin/validate'
import { fail, jsonBody, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ resource: string }> }

export async function GET(request: Request, { params }: Context) {
  const { resource } = await params
  const guard = await guardResource(request, resource, 'read')
  if ('blocked' in guard) return guard.blocked
  const query = parseListParams(new URL(request.url))
  const result = await guard.handler.list(query)
  return ok({ ...result, page: query.page, pageSize: query.pageSize })
}

export async function POST(request: Request, { params }: Context) {
  const { resource } = await params
  const guard = await guardResource(request, resource, 'write')
  if ('blocked' in guard) return guard.blocked
  if (!guard.meta.create || !guard.handler.create) return fail('Este recurso não aceita criação.', 405)
  const body = await jsonBody<unknown>(request)
  if (body === null) return fail('Corpo da requisição inválido.', 400)
  const { values, errors } = validateResource(guard.meta, body, 'create')
  if (Object.keys(errors).length) return fail('Revise os campos destacados.', 422, errors)
  const result = await guard.handler.create(values, guard.userId)
  if ('errors' in result) return fail(Object.values(result.errors)[0] ?? 'Não foi possível salvar.', result.status ?? 422, result.errors)
  await recordAudit({ actorUserId: guard.userId, action: `${resource}.create`, entityType: guard.meta.singular, entityId: result.row.id, after: result.row })
  revalidateFor(guard.handler)
  return ok(result.row, { status: 201 })
}
