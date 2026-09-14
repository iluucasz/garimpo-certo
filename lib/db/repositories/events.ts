import { desc } from 'drizzle-orm'
import { db } from '../client'
import { analyticsEvents } from '../schema'

export type DomainEventType = 'ProductCreated' | 'ProductUpdated' | 'OfferUpdated' | 'PriceChanged' | 'AffiliateClicked' | 'ConversionReceived' | 'FavoriteAdded'

export async function listEvents() {
  return db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.timestamp)).limit(250)
}

export async function publishEvent(type: DomainEventType, aggregateId: string, payload: Record<string, unknown>) {
  const isProductAggregate = type === 'ProductCreated' || type === 'ProductUpdated'
  const isOfferAggregate = type === 'OfferUpdated' || type === 'PriceChanged' || type === 'AffiliateClicked'
  const [row] = await db.insert(analyticsEvents).values({
    eventName: type,
    anonymousId: 'server',
    sessionId: 'server',
    productId: isProductAggregate ? aggregateId : undefined,
    offerId: isOfferAggregate ? aggregateId : undefined,
    metadata: { aggregateId, ...payload },
  }).returning()
  return row
}
