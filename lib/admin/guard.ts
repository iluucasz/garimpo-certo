import { invalidate } from '@/lib/db/invalidate'
import { authorize, fail } from '@/lib/server/api'
import { handlers, type Handler } from './resources'
import { isResourceSlug, resources, type ResourceMeta } from './resource-meta'

export type ResourceContext = { meta: ResourceMeta; handler: Handler; userId: string }

/** Resolve o recurso pelo endereço e confere a permissão de leitura ou escrita do papel. */
export async function guardResource(request: Request, slug: string, access: 'read' | 'write'): Promise<{ blocked: Response } | ResourceContext> {
  if (!isResourceSlug(slug)) return { blocked: fail('Recurso desconhecido.', 404) }
  const meta = resources[slug]
  const { blocked, userId } = await authorize(request, access === 'read' ? meta.read : meta.write)
  if (blocked) return { blocked }
  return { meta, handler: handlers[slug], userId }
}

export function revalidateFor(handler: Handler) {
  invalidate(...(handler.revalidate ?? []))
}

export function parseListParams(url: URL) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1)
  const size = Math.floor(Number(url.searchParams.get('pageSize'))) || 25
  return {
    q: (url.searchParams.get('q') ?? '').slice(0, 100),
    page,
    pageSize: Math.min(100, Math.max(1, size)),
    filter: (url.searchParams.get('filter') ?? '').slice(0, 40),
    sort: (url.searchParams.get('sort') ?? '').slice(0, 24),
  }
}
