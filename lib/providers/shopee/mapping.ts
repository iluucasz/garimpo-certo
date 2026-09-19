import type { ShopeeProductOffer } from './client'

export type CatalogItem = {
  externalId: string; slug: string; name: string; brandName: string; description: string
  categorySlug: string; imageUrl: string; rating: number; editorialScore: number; tags: string[]
  price: number; priceMax: number | null; originalPrice: number | null; discountPercentage: number; commissionRate: number
  estimatedCommission: number; soldCount: number; sellerName: string; externalUrl: string; affiliateUrl: string
}

export const slugify = (value: string) => value
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/**
 * Preço cheio a partir do desconto informado pela Shopee.
 * Só é confiável quando a oferta tem preço único: em produtos com variações, o desconto
 * se refere a uma variação e não fecha com o menor preço, o que geraria um "de/por" falso.
 */
export function originalPriceFrom(price: number, priceMax: number, discountPercentage: number) {
  if (priceMax > price) return null
  if (!discountPercentage || discountPercentage <= 0 || discountPercentage > 90) return null
  return Math.round((price / (1 - discountPercentage / 100)) * 100) / 100
}

/**
 * Índice Garimpo: nota 0–100 calculada só com dados reais da oferta —
 * avaliação (55), volume de vendas em escala logarítmica (30) e desconto (15).
 * A avaliação é normalizada na faixa 3,5–5,0, que é onde ficam as ofertas da vitrine;
 * sem isso quase todo produto tiraria nota alta e o índice não separaria nada.
 */
export function editorialScoreFrom({ rating, sales, discountPercentage }: { rating: number; sales: number; discountPercentage: number }) {
  const quality = Math.min(Math.max((rating - 3.5) / 1.5, 0), 1) * 55
  const popularity = Math.min(Math.log10(Math.max(sales, 0) + 1) / 5, 1) * 30
  const deal = Math.min(Math.max(discountPercentage, 0) / 60, 1) * 15
  return Math.round(quality + popularity + deal)
}

/** Etiquetas derivadas dos números da própria oferta — nada é atribuído manualmente. */
export function tagsFrom({ rating, sales, discountPercentage, commissionRate }: { rating: number; sales: number; discountPercentage: number; commissionRate: number }) {
  const tags: string[] = []
  if (sales >= 500) tags.push('Mais vendido')
  if (discountPercentage >= 20) tags.push('Em promoção')
  if (rating >= 4.8 && sales >= 50) tags.push('Bem avaliado')
  if (commissionRate >= 0.15) tags.push('Alta comissão')
  return tags
}

const price = (value: string | undefined, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function toCatalogItem(offer: ShopeeProductOffer, categorySlug: string): CatalogItem {
  const current = price(offer.priceMin, price(offer.price))
  const maximum = price(offer.priceMax, current)
  const discountPercentage = Math.max(0, Math.min(offer.priceDiscountRate ?? 0, 99))
  const rating = Math.min(Math.max(Number(offer.ratingStar) || 0, 0), 5)
  const sales = Math.max(0, Number(offer.sales) || 0)
  const commissionRate = Math.max(0, Number(offer.commissionRate) || 0)
  const sellerName = offer.shopName?.trim() || 'Loja Shopee'
  const name = offer.productName.trim()
  return {
    externalId: String(offer.itemId),
    slug: `${slugify(name).slice(0, 70).replace(/-$/, '')}-${offer.itemId}`,
    name,
    brandName: sellerName,
    description: `Vendido por ${sellerName} na Shopee.`,
    categorySlug,
    imageUrl: offer.imageUrl,
    rating,
    editorialScore: editorialScoreFrom({ rating, sales, discountPercentage }),
    tags: tagsFrom({ rating, sales, discountPercentage, commissionRate }),
    price: current,
    priceMax: maximum > current ? maximum : null,
    originalPrice: originalPriceFrom(current, maximum, discountPercentage),
    discountPercentage,
    commissionRate,
    estimatedCommission: price(offer.commission, Math.round(current * commissionRate * 100) / 100),
    soldCount: sales,
    sellerName,
    externalUrl: offer.productLink,
    affiliateUrl: offer.offerLink,
  }
}

/** Mantém só ofertas utilizáveis na vitrine: com imagem, link, preço e reputação mínima. */
export function isUsableOffer(offer: ShopeeProductOffer, { minRating = 4, minSales = 20 } = {}) {
  const rating = Number(offer.ratingStar) || 0
  const sales = Number(offer.sales) || 0
  const current = Number(offer.priceMin) || Number(offer.price) || 0
  return Boolean(offer.imageUrl) && Boolean(offer.offerLink) && current > 0 && rating >= minRating && sales >= minSales
}
