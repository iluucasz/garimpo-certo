import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { affiliateClicks, affiliateConversions, commissionTransactions, offers } from '@/lib/db/schema'

export type ConversionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'paid'
export type AttributionFilter = { providerId?: string; slot?: string; status?: ConversionStatus }

export function createSafeSubId(parts: string[]) {
  const value = parts.map((part) => part.toLowerCase().replace(/[^a-z0-9_-]/g, '-')).join('_').slice(0, 96)
  if (value.includes('@')) throw new Error('PII não permitida em sub_id')
  return value
}

export async function recordAffiliateClick(input: { offerId: string; subId: string; slot?: string; sessionId: string; anonymousId?: string; userId?: string }) {
  const [row] = await db.insert(affiliateClicks).values({
    clickId: `clk_${crypto.randomUUID().slice(0, 8)}`,
    offerId: input.offerId,
    anonymousId: input.anonymousId ?? input.sessionId,
    sessionId: input.sessionId,
    userId: input.userId,
    subId: input.subId,
    recommendationSlotId: input.slot,
  }).returning()
  return row
}

export async function recordConversion(input: { providerConversionId: string; clickId?: string; providerId: string; orderReferenceHash: string; amount: number; commission: number; status: ConversionStatus }) {
  const [row] = await db.insert(affiliateConversions).values({
    providerConversionId: input.providerConversionId, clickId: input.clickId, providerId: input.providerId,
    orderReferenceHash: input.orderReferenceHash, amount: String(input.amount), commission: String(input.commission),
    status: input.status, convertedAt: new Date().toISOString(),
  }).returning()
  await db.insert(commissionTransactions).values({ conversionId: row.id, amount: String(input.commission), status: 'pending' })
  return row
}

export async function getAttribution(filter: AttributionFilter = {}) {
  const clickRows = await db.select({ click: affiliateClicks, offerProviderId: offers.providerId })
    .from(affiliateClicks).leftJoin(offers, eq(affiliateClicks.offerId, offers.id))
  const filteredClicks = clickRows
    .filter((row) => (!filter.providerId || row.offerProviderId === filter.providerId) && (!filter.slot || row.click.recommendationSlotId === filter.slot))
    .map((row) => row.click)

  const clickIds = new Set(filteredClicks.map((click) => click.clickId))
  const conversionRows = await db.select().from(affiliateConversions)
  const filteredConversions = conversionRows.filter((conversion) =>
    (!filter.providerId || conversion.providerId === filter.providerId) &&
    (!filter.status || conversion.status === filter.status) &&
    (!conversion.clickId || filteredClicks.length === clickRows.length || clickIds.has(conversion.clickId)),
  )

  const sum = (statuses: ConversionStatus[]) => filteredConversions.filter((c) => statuses.includes(c.status)).reduce((total, c) => total + Number(c.commission), 0)
  return {
    clicks: filteredClicks,
    conversions: filteredConversions,
    metrics: {
      clicks: filteredClicks.length,
      validClicks: filteredClicks.length,
      conversions: filteredConversions.length,
      conversionRate: filteredClicks.length ? filteredConversions.length / filteredClicks.length : 0,
      estimatedCommission: sum(['pending', 'approved', 'paid']),
      approvedCommission: sum(['approved', 'paid']),
      paidCommission: sum(['paid']),
      invalidTraffic: 0,
    },
    funnel: [
      { name: 'Cliques', value: filteredClicks.length },
      { name: 'Cliques válidos', value: filteredClicks.length },
      { name: 'Conversão', value: filteredConversions.length },
    ],
    quality: {
      highRisk: [] as (typeof filteredClicks),
      mediumRisk: [] as (typeof filteredClicks),
      unattributed: filteredConversions.filter((c) => !c.clickId || !clickIds.has(c.clickId)).length,
    },
  }
}
