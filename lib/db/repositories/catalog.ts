import { and, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '../client'
import { brands, categories, productCategories, productImages, products, productTags, tags } from '../schema'

export type CatalogProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  brand: { id: string; name: string; slug: string } | null
  category: { id: string; name: string; slug: string } | null
  images: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

type ProductRow = typeof products.$inferSelect

async function hydrate(rows: ProductRow[]): Promise<CatalogProduct[]> {
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const brandIds = [...new Set(rows.map((row) => row.brandId).filter((value): value is string => Boolean(value)))]
  const [brandRows, categoryRows, imageRows, tagRows] = await Promise.all([
    brandIds.length ? db.select().from(brands).where(inArray(brands.id, brandIds)) : Promise.resolve([]),
    db.select({ productId: productCategories.productId, id: categories.id, name: categories.name, slug: categories.slug })
      .from(productCategories).innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(and(inArray(productCategories.productId, ids), eq(productCategories.isPrimary, true))),
    db.select().from(productImages).where(inArray(productImages.productId, ids)),
    db.select({ productId: productTags.productId, label: tags.label })
      .from(productTags).innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(inArray(productTags.productId, ids)),
  ])
  const brandById = new Map(brandRows.map((row) => [row.id, row]))
  const categoryByProduct = new Map(categoryRows.map((row) => [row.productId, row]))
  const imagesByProduct = new Map<string, string[]>()
  for (const image of imageRows) imagesByProduct.set(image.productId, [...(imagesByProduct.get(image.productId) ?? []), image.sourceUrl])
  const tagsByProduct = new Map<string, string[]>()
  for (const tag of tagRows) tagsByProduct.set(tag.productId, [...(tagsByProduct.get(tag.productId) ?? []), tag.label])

  return rows.map((row) => {
    const brand = row.brandId ? brandById.get(row.brandId) ?? null : null
    const category = categoryByProduct.get(row.id) ?? null
    return {
      id: row.id, slug: row.slug, name: row.name, description: row.description, status: row.status,
      brand: brand ? { id: brand.id, name: brand.name, slug: brand.slug } : null,
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      images: imagesByProduct.get(row.id) ?? [], tags: tagsByProduct.get(row.id) ?? [],
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    }
  })
}

export async function listProducts(query = ''): Promise<CatalogProduct[]> {
  const rows = query.trim()
    ? await db.select().from(products).where(or(ilike(products.name, `%${query}%`), ilike(products.slug, `%${query}%`)))
    : await db.select().from(products)
  return hydrate(rows)
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getProduct(identifier: string): Promise<CatalogProduct | null> {
  const [row] = await db.select().from(products).where(uuidPattern.test(identifier) ? eq(products.id, identifier) : eq(products.slug, identifier))
  if (!row) return null
  return (await hydrate([row]))[0]
}

export async function findProductBySlug(slug: string): Promise<{ id: string } | null> {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug))
  return row ?? null
}

export type CreateProductInput = { slug: string; name: string; description?: string; brandId?: string; categoryId?: string; status?: string }

export async function createProduct(input: CreateProductInput): Promise<CatalogProduct> {
  const [row] = await db.insert(products).values({
    slug: input.slug, name: input.name, description: input.description, brandId: input.brandId, status: (input.status ?? 'active') as ProductRow['status'],
  }).returning()
  if (input.categoryId) await db.insert(productCategories).values({ productId: row.id, categoryId: input.categoryId, isPrimary: true })
  return (await hydrate([row]))[0]
}

export type UpdateProductInput = Partial<{ name: string; description: string; brandId: string; status: ProductRow['status'] }>

export async function updateProduct(id: string, patch: UpdateProductInput): Promise<CatalogProduct | null> {
  const [row] = await db.update(products).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(products.id, id)).returning()
  if (!row) return null
  return (await hydrate([row]))[0]
}

export async function removeProduct(id: string): Promise<boolean> {
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id })
  return Boolean(row)
}
