import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { wishlistItems, wishlists } from '../schema'

const DEFAULT_WISHLIST_NAME = 'Favoritos'

async function getOrCreateDefaultWishlist(userId: string) {
  const [existing] = await db.select({ id: wishlists.id }).from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.name, DEFAULT_WISHLIST_NAME)))
  if (existing) return existing.id
  const [row] = await db.insert(wishlists).values({ userId, name: DEFAULT_WISHLIST_NAME }).returning({ id: wishlists.id })
  return row.id
}

export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const wishlistId = await getOrCreateDefaultWishlist(userId)
  const rows = await db.select({ productId: wishlistItems.productId }).from(wishlistItems).where(eq(wishlistItems.wishlistId, wishlistId))
  return rows.map((row) => row.productId)
}

export async function toggleWishlistItem(userId: string, productId: string): Promise<{ added: boolean; productIds: string[] }> {
  const wishlistId = await getOrCreateDefaultWishlist(userId)
  const [existing] = await db.select({ id: wishlistItems.id }).from(wishlistItems).where(and(eq(wishlistItems.wishlistId, wishlistId), eq(wishlistItems.productId, productId)))
  if (existing) await db.delete(wishlistItems).where(eq(wishlistItems.id, existing.id))
  else await db.insert(wishlistItems).values({ wishlistId, productId })
  const productIds = await listWishlistProductIds(userId)
  return { added: !existing, productIds }
}

export async function mergeWishlistItems(userId: string, productIds: string[]): Promise<string[]> {
  const wishlistId = await getOrCreateDefaultWishlist(userId)
  const existingIds = new Set(await listWishlistProductIds(userId))
  const toAdd = productIds.filter((id) => !existingIds.has(id))
  if (toAdd.length) await db.insert(wishlistItems).values(toAdd.map((productId) => ({ wishlistId, productId })))
  return listWishlistProductIds(userId)
}
