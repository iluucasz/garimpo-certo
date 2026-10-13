import { asc, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { brands, categories, products, roles, tags } from '@/lib/db/schema'
import { authorize, fail, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ kind: string }> }

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietário', ADMIN: 'Administrador', MARKETING: 'Marketing', CATALOG_MANAGER: 'Gestor de catálogo',
  ANALYST: 'Analista', SUPPORT: 'Suporte', READ_ONLY: 'Somente leitura',
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Opções para os campos de seleção do painel. Produtos aceitam busca (`q`) e `ids` para rotular os já escolhidos. */
export async function GET(request: Request, { params }: Context) {
  const { kind } = await params
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80)

  if (kind === 'categories') {
    return ok(await db.select({ value: categories.id, label: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)))
  }
  if (kind === 'tags') {
    return ok(await db.select({ value: tags.id, label: tags.label }).from(tags).orderBy(asc(tags.label)))
  }
  if (kind === 'brands') {
    return ok(await db.select({ value: brands.id, label: brands.name }).from(brands).orderBy(asc(brands.name)).limit(300))
  }
  if (kind === 'roles') {
    const rows = await db.select({ value: roles.id, code: roles.code }).from(roles)
    return ok(rows.map((row) => ({ value: row.value, label: roleLabels[row.code] ?? row.code })))
  }
  if (kind === 'products') {
    const ids = (url.searchParams.get('ids') ?? '').split(',').map((id) => id.trim()).filter((id) => uuidPattern.test(id)).slice(0, 120)
    const columns = { value: products.id, label: products.name, slug: products.slug, status: products.status }
    if (ids.length) return ok(await db.select(columns).from(products).where(inArray(products.id, ids)))
    const like = q ? `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%` : null
    return ok(await db.select(columns).from(products)
      .where(like ? or(ilike(products.name, like), ilike(products.slug, like)) : eq(products.status, 'active'))
      .orderBy(desc(products.updatedAt)).limit(20))
  }
  return fail('Lista desconhecida.', 404)
}
