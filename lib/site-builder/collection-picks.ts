import type { Offer, Product } from '@/lib/types'

type CollectionLike = { slug: string; products: { id: string }[] }
type CollectionBlockLike = { id: string; settings: { collection?: string; count?: number } }

/** Quantos produtos a vitrine principal da home mostra de início (a aba "Em alta"). */
export const HOME_FEATURED_COUNT = 8
const DEFAULT_COUNT = 8

/**
 * Os produtos que a aba "Em alta" da vitrine principal mostra ao abrir a home: mais vendidos pela melhor oferta
 * (a de menor preço com frete, entre as disponíveis). Mesma regra do `HomeCatalog`, para a home não repetir o que já está ali.
 */
export function featuredProductIds(products: Product[], offers: Offer[], count = HOME_FEATURED_COUNT): string[] {
  const best = new Map<string, Offer>()
  for (const offer of offers) {
    if (offer.stock === 'indisponível') continue
    const current = best.get(offer.productId)
    if (!current || offer.price + offer.shipping < current.price + current.shipping) best.set(offer.productId, offer)
  }
  return [...products]
    .sort((a, b) => (best.get(b.id)?.soldCount ?? 0) - (best.get(a.id)?.soldCount ?? 0))
    .slice(0, count)
    .map((product) => product.id)
}

/**
 * Escolhe, na ordem da página, os produtos de cada bloco de coleção sem repetir nenhum já mostrado (`seen` entra com o que
 * a vitrine principal exibe). Se uma coleção não tem produtos novos o bastante, completa com os melhores dela para a
 * fileira não ficar curta. Coleção desconhecida fica de fora (o bloco some sozinho).
 */
export function pickCollectionProducts(blocks: CollectionBlockLike[], collections: CollectionLike[], seen: Iterable<string> = []): Map<string, string[]> {
  const used = new Set(seen)
  const bySlug = new Map(collections.map((collection) => [collection.slug, collection]))
  const picks = new Map<string, string[]>()
  for (const block of blocks) {
    const collection = block.settings.collection ? bySlug.get(block.settings.collection) : undefined
    if (!collection) continue
    const count = block.settings.count ?? DEFAULT_COUNT
    const fresh = collection.products.filter((product) => !used.has(product.id)).slice(0, count)
    const chosen = fresh.length >= count
      ? fresh
      : [...fresh, ...collection.products.filter((product) => !fresh.some((item) => item.id === product.id)).slice(0, count - fresh.length)]
    for (const product of chosen) used.add(product.id)
    picks.set(block.id, chosen.map((product) => product.id))
  }
  return picks
}
