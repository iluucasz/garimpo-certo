import { listOffers } from '@/lib/db/repositories/offers'
import { ok } from '@/lib/server/api'
export async function GET(request: Request) { const productId = new URL(request.url).searchParams.get('productId') ?? undefined; return ok(await listOffers(productId)) }
