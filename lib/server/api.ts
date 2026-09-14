import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { userHasPermission } from '@/lib/auth/permissions'
import type { Permission } from '@/lib/auth/rbac'

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json({ data, meta: { mode: 'real', timestamp: new Date().toISOString() } }, init)
const errorCodes: Record<number, string> = { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'VALIDATION_ERROR', 428: 'PRECONDITION_REQUIRED', 429: 'RATE_LIMITED' }
export const fail = (message: string, status = 400, details?: unknown, headers?: HeadersInit) => NextResponse.json({ error: { code: errorCodes[status] ?? 'REQUEST_FAILED', message, ...(details === undefined ? {} : { details }) }, meta: { mode: 'real', timestamp: new Date().toISOString() } }, { status, headers })

export async function authorize(request: Request, permission: Permission) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { blocked: fail('Sessão inválida ou ausente.', 401), userId: null as never }
  const allowed = await userHasPermission(session.user.id, permission)
  if (!allowed) return { blocked: fail(`Seu usuário não possui a permissão ${permission}.`, 403), userId: null as never }
  return { blocked: null, userId: session.user.id }
}

export async function jsonBody<T>(request: Request): Promise<T | null> { try { return await request.json() as T } catch { return null } }
