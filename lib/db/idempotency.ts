import { eq } from 'drizzle-orm'
import { db } from './client'
import { idempotencyKeys } from './schema'

export async function withIdempotency<T>(key: string, operation: () => Promise<T>): Promise<{ replayed: boolean; value: T }> {
  const [existing] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key))
  if (existing) return { replayed: true, value: existing.value as T }
  const value = await operation()
  await db.insert(idempotencyKeys).values({ key, value: value as unknown, expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString() }).onConflictDoNothing()
  return { replayed: false, value }
}
