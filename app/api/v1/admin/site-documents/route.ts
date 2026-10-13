import { recordAudit } from '@/lib/admin/audit'
import { buildCollections } from '@/lib/catalog/collections'
import { getCatalogRules } from '@/lib/catalog/server-rules'
import { invalidate } from '@/lib/db/invalidate'
import { createPage, DOCUMENT_TAG, listPages } from '@/lib/db/repositories/site-documents'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { MAX_SLUG, pageSlugPattern, slugify } from '@/lib/site-builder/document'

export const dynamic = 'force-dynamic'

/** Páginas criadas no painel e as coleções que os blocos "Produtos de uma coleção" podem apontar. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const [pages, catalog, rules] = await Promise.all([listPages(), getStoreCatalog(), getCatalogRules()])
  const collections = buildCollections({ ...catalog, rules }).map((item) => ({ slug: item.slug, title: item.title, group: item.group }))
  return ok({ pages, collections })
}

/** Cria uma página nova (rascunho, fora do ar). O endereço sai do título, a menos que venha um `slug`. */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  const body = await jsonBody<{ title?: string; slug?: string }>(request)
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 70) : ''
  if (!title) return fail('Dê um título à página.', 422, { title: 'Dê um título à página.' })
  const slug = slugify(typeof body?.slug === 'string' && body.slug.trim() ? body.slug : title)
  if (!slug || slug.length > MAX_SLUG || !pageSlugPattern.test(slug)) return fail('Use letras e números no endereço.', 422, { slug: 'Use letras e números no endereço.' })
  const page = await createPage(slug, title, userId)
  if (!page) return fail('Já existe uma página com esse endereço.', 409, { slug: 'Já existe uma página com esse endereço.' })
  invalidate(DOCUMENT_TAG)
  await recordAudit({ actorUserId: userId, action: 'site.create', entityType: 'página', entityId: page.key, after: { title } })
  return ok(page, { status: 201 })
}
