import { withIdempotency } from '@/lib/db/idempotency'
import { processJob } from '@/lib/db/repositories/jobs'
import { authorize, fail, ok } from '@/lib/server/api'
type Context = { params: Promise<{ id: string }> }
export async function POST(request: Request, context: Context) {
  const { blocked } = await authorize(request, 'jobs:run'); if (blocked) return blocked
  const key = request.headers.get('idempotency-key'); if (!key) return fail('Idempotency-Key é obrigatório.', 428)
  const { id } = await context.params
  const result = await withIdempotency(key, () => processJob(id))
  return result.value ? ok({ ...result.value, replayed: result.replayed }) : fail('Job não encontrado.', 404)
}
