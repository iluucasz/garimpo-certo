import { eq } from 'drizzle-orm'
import { db } from '../client'
import { offers } from '../schema'

export async function listOffers(productId?: string) {
  return productId ? db.select().from(offers).where(eq(offers.productId, productId)) : db.select().from(offers)
}
