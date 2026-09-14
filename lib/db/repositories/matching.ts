import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { providerProductMappings } from '../schema'
import type { MatchCandidate } from '@/lib/server/ingestion'

export type MatchStatus = 'auto_merged' | 'pending_review' | 'separate'

const AUTO_MERGE_THRESHOLD = 0.78

export function resolveMatchStatus(candidates: MatchCandidate[]): MatchStatus {
  if (!candidates.length) return 'separate'
  return candidates[0].confidence >= AUTO_MERGE_THRESHOLD ? 'auto_merged' : 'pending_review'
}

export async function recordProviderProductMapping(input: {
  providerId: string
  externalProductId: string
  candidates: MatchCandidate[]
}) {
  const status = resolveMatchStatus(input.candidates)
  const top = input.candidates[0]
  const values = {
    providerId: input.providerId,
    externalProductId: input.externalProductId,
    productId: top?.productId,
    confidenceScore: (top?.confidence ?? 0).toFixed(3),
    matchStatus: status,
  }
  if (!values.productId) return null

  const [existing] = await db.select({ id: providerProductMappings.id })
    .from(providerProductMappings)
    .where(and(eq(providerProductMappings.providerId, input.providerId), eq(providerProductMappings.externalProductId, input.externalProductId)))

  if (existing) {
    const [row] = await db.update(providerProductMappings).set(values).where(eq(providerProductMappings.id, existing.id)).returning()
    return row
  }
  const [row] = await db.insert(providerProductMappings).values(values).returning()
  return row
}
