import type { Offer, Product, ProductMetrics } from '@/lib/types'

const categories = ['audio', 'tecnologia', 'casa', 'cozinha', 'bem-estar']

/** Catálogo sintético no mesmo formato do real, para testar a engine sem banco nem rede. */
export function buildCatalog(size = 12) {
  const products: Product[] = Array.from({ length: size }, (_, index) => ({
    id: String(index + 1), slug: `produto-${index + 1}`, name: `Produto ${index + 1}`,
    brand: `Loja ${index % 4}`, category: categories[index % categories.length],
    description: '', longDescription: '', image: '/placeholder.jpg', images: [],
    rating: 4 + (index % 10) / 10, reviews: 0, score: 60 + index, growth: 0,
    tags: [], specs: {}, priceHistory: [{ month: 'Set', price: 50 + index * 10 }],
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
  }))
  const offers: Offer[] = products.map((product, index) => ({
    id: `offer-${product.id}`, productId: product.id, providerId: 'shopee', price: 50 + index * 10,
    previousPrice: index % 3 === 0 ? 80 + index * 10 : undefined, shipping: 0, installment: '',
    stock: 'disponível', url: `https://s.shopee.com.br/${product.id}`, updatedAt: 'há 1 min',
    soldCount: 100 * (index + 1), commissionRate: 0.05 + (index % 5) / 100,
  }))
  return { products, offers }
}

export const metricsFor = (productId: string, patch: Partial<ProductMetrics> = {}): Record<string, ProductMetrics> => ({
  [productId]: { views: 0, clicks: 0, favorites: 0, conversions: 0, views24h: 0, views7d: 0, clicks7d: 0, ...patch },
})
