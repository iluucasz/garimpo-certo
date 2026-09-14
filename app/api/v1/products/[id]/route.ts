import { getProduct, removeProduct, updateProduct } from '@/lib/db/repositories/catalog'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { sanitizeProductPatch } from '@/lib/server/validation'

type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, context: Context) { const { id } = await context.params; const product = await getProduct(id); return product ? ok(product) : fail('Produto não encontrado.', 404) }
export async function PATCH(request: Request, context: Context) { const { blocked } = await authorize(request, 'catalog:write'); if (blocked) return blocked; const { id } = await context.params; const body = sanitizeProductPatch(await jsonBody<unknown>(request)); if (!body) return fail('Payload de atualização inválido.', 422); const product = await updateProduct(id, body); return product ? ok(product) : fail('Produto não encontrado.', 404) }
export async function DELETE(request: Request, context: Context) { const { blocked } = await authorize(request, 'catalog:write'); if (blocked) return blocked; const { id } = await context.params; return (await removeProduct(id)) ? ok({ deleted: true, id }) : fail('Produto não encontrado.', 404) }
