import { auth } from '@/lib/auth/auth'
import { listWishlistProductIds, mergeWishlistItems } from '@/lib/db/repositories/wishlist'
import { fail, jsonBody, ok } from '@/lib/server/api'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Sessão inválida ou ausente.', 401)
  return ok(await listWishlistProductIds(session.user.id))
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Sessão inválida ou ausente.', 401)
  const body = await jsonBody<{ productIds?: string[] }>(request)
  if (!Array.isArray(body?.productIds)) return fail('productIds deve ser um array.', 422)
  return ok(await mergeWishlistItems(session.user.id, body.productIds))
}
