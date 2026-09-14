const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export type ProductStatus = 'active' | 'unavailable' | 'discontinued' | 'removed'
const productStatuses: ProductStatus[] = ['active', 'unavailable', 'discontinued', 'removed']
const isProductStatus = (value: unknown): value is ProductStatus => typeof value === 'string' && (productStatuses as string[]).includes(value)

export type ProductInput = { slug: string; name: string; description?: string; brandId?: string; categoryId?: string; status?: ProductStatus }

export function validateProductInput(value: unknown): { valid: true; data: ProductInput } | { valid: false; issues: string[] } {
  if (!isRecord(value)) return { valid: false, issues: ['O payload deve ser um objeto.'] }
  const issues: string[] = []
  if (typeof value.name !== 'string' || value.name.trim().length < 2) issues.push('name deve conter pelo menos 2 caracteres.')
  if (typeof value.slug !== 'string' || !slugPattern.test(value.slug)) issues.push('slug deve usar letras minúsculas, números e hífens.')
  if (value.brandId !== undefined && (typeof value.brandId !== 'string' || !uuidPattern.test(value.brandId))) issues.push('brandId deve ser um UUID válido.')
  if (value.categoryId !== undefined && (typeof value.categoryId !== 'string' || !uuidPattern.test(value.categoryId))) issues.push('categoryId deve ser um UUID válido.')
  if (value.status !== undefined && !isProductStatus(value.status)) issues.push('status inválido.')
  if (issues.length) return { valid: false, issues }
  return {
    valid: true,
    data: {
      slug: String(value.slug), name: String(value.name).trim(),
      description: typeof value.description === 'string' ? value.description : undefined,
      brandId: typeof value.brandId === 'string' ? value.brandId : undefined,
      categoryId: typeof value.categoryId === 'string' ? value.categoryId : undefined,
      status: isProductStatus(value.status) ? value.status : undefined,
    },
  }
}

export function sanitizeProductPatch(value: unknown): Partial<ProductInput> | null {
  if (!isRecord(value)) return null
  const patch: Partial<ProductInput> = {}
  if (typeof value.name === 'string' && value.name.trim().length >= 2) patch.name = value.name.trim()
  if (typeof value.description === 'string') patch.description = value.description
  if (typeof value.brandId === 'string' && uuidPattern.test(value.brandId)) patch.brandId = value.brandId
  if (isProductStatus(value.status)) patch.status = value.status
  return Object.keys(patch).length ? patch : null
}
