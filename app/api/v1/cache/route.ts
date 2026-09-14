import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { mockCache } from '@/lib/server/mock-cache'
export async function GET(request: Request) { const { blocked } = await authorize(request, 'settings:write'); if (blocked) return blocked; return ok(mockCache.stats()) }
export async function DELETE(request: Request) { const { blocked } = await authorize(request, 'settings:write'); if (blocked) return blocked; const body = await jsonBody<{ prefix: string }>(request); if (!body?.prefix) return fail('prefix é obrigatório.', 422); return ok({ invalidated: mockCache.invalidate(body.prefix) }) }
