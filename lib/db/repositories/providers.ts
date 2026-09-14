import { eq } from 'drizzle-orm'
import { db } from '../client'
import { providers } from '../schema'

export async function listProviders() {
  return db.select().from(providers)
}

export async function getProviderByCode(code: string) {
  const [row] = await db.select().from(providers).where(eq(providers.code, code))
  return row ?? null
}
