import { createProduct, findProductBySlug, listProducts } from '@/lib/db/repositories/catalog'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { validateProductInput } from '@/lib/server/validation'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  return ok(await listProducts(query))
}
export async function POST(request: Request) {
  const { blocked } = await authorize(request, 'catalog:write'); if (blocked) return blocked
  const body = await jsonBody<unknown>(request)
  const validation = validateProductInput(body)
  if (!validation.valid) return fail('Produto inválido.', 422, { issues: validation.issues })
  if (await findProductBySlug(validation.data.slug)) return fail('Já existe um produto com este slug.', 409)
  return ok(await createProduct(validation.data), { status: 201 })
}
