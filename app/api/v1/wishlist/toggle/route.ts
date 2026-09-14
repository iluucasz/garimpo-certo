import { auth } from '@/lib/auth/auth'
import { toggleWishlistItem } from '@/lib/db/repositories/wishlist'
import { fail, jsonBody, ok } from '@/lib/server/api'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return fail('Sessão inválida ou ausente.', 401)
  const body = await jsonBody<{ productId?: string }>(request)
  if (!body?.productId) return fail('productId é obrigatório.', 422)
  return ok(await toggleWishlistItem(session.user.id, body.productId))
}
