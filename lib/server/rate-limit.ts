type Bucket = { count: number; resetAt: number }

declare global { var __garimpoRateLimits: Map<string, Bucket> | undefined }
const buckets = globalThis.__garimpoRateLimits ?? new Map<string, Bucket>()
globalThis.__garimpoRateLimits = buckets

export function rateLimit(request: Request, namespace: string, limit = 30, windowMs = 60_000) {
  const identity = request.headers.get('x-mock-client') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const key = `${namespace}:${identity}`
  const now = Date.now()
  const current = buckets.get(key)
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
  bucket.count += 1
  buckets.set(key, bucket)
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
}

export function resetRateLimits() { buckets.clear() }
