import { withIdempotency } from '@/lib/db/idempotency'
import { enqueueJob, listJobs } from '@/lib/db/repositories/jobs'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
export async function GET(request: Request) { const { blocked } = await authorize(request, 'jobs:run'); if (blocked) return blocked; return ok(await listJobs()) }
export async function POST(request: Request) {
  const { blocked } = await authorize(request, 'jobs:run'); if (blocked) return blocked
  const key = request.headers.get('idempotency-key'); if (!key) return fail('Idempotency-Key é obrigatório.', 428)
  const body = await jsonBody<{ topic: string; payload?: Record<string, unknown> }>(request)
  if (!body?.topic) return fail('topic é obrigatório.', 422)
  const result = await withIdempotency(key, () => enqueueJob(body.topic, body.payload ?? {}))
  return ok({ ...result.value, replayed: result.replayed }, { status: result.replayed ? 200 : 202 })
}
