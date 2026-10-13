import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products, roles, userRoles, users, wishlistItems, wishlists } from '@/lib/db/schema'

/** Tudo o que o Garimpo guarda no servidor sobre uma conta, para acesso e portabilidade (LGPD). */
export async function getAccountExport(userId: string) {
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId))

  const favorites = await db.select({
    list: wishlists.name,
    productName: products.name,
    productSlug: products.slug,
    addedAt: wishlistItems.addedAt,
  })
    .from(wishlistItems)
    .innerJoin(wishlists, eq(wishlistItems.wishlistId, wishlists.id))
    .innerJoin(products, eq(wishlistItems.productId, products.id))
    .where(eq(wishlists.userId, userId))

  const accessRoles = await db.select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))

  return {
    exportedAt: new Date().toISOString(),
    user: user ?? null,
    favorites,
    roles: accessRoles.map((role) => role.code),
  }
}
