import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { affiliateConversionItems, affiliateConversions, commissionTransactions, offers } from '../schema'
import type { ConversionRecord } from '@/lib/providers/shopee/conversions'

export type ConversionUpsertSummary = { created: number; updated: number; unchanged: number; items: number; itemsWithoutOffer: number }

const CHUNK = 50
const fixed = (value: number) => value.toFixed(2)

/**
 * Grava as conversões vindas do relatório da Shopee. Idempotente: a chave é (id da conversão, provedor), então
 * rodar de novo só atualiza status, valores e itens. O que a equipe marcou como `paid` nunca volta atrás.
 */
export async function upsertConversions(records: ConversionRecord[], providerId: string): Promise<ConversionUpsertSummary> {
  const summary: ConversionUpsertSummary = { created: 0, updated: 0, unchanged: 0, items: 0, itemsWithoutOffer: 0 }

  for (let start = 0; start < records.length; start += CHUNK) {
    const chunk = records.slice(start, start + CHUNK)

    const existingRows = await db.select({
      id: affiliateConversions.id, providerConversionId: affiliateConversions.providerConversionId, status: affiliateConversions.status,
      amount: affiliateConversions.amount, commission: affiliateConversions.commission, subIds: affiliateConversions.subIds,
      buyerType: affiliateConversions.buyerType,
    }).from(affiliateConversions).where(and(
      eq(affiliateConversions.providerId, providerId),
      inArray(affiliateConversions.providerConversionId, chunk.map((record) => record.providerConversionId)),
    ))
    const existing = new Map(existingRows.map((row) => [row.providerConversionId, row]))

    const itemIds = [...new Set(chunk.flatMap((record) => record.items.map((item) => item.externalItemId)))]
    const offerRows = itemIds.length
      ? await db.select({ id: offers.id, externalId: offers.externalId }).from(offers).where(and(eq(offers.providerId, providerId), inArray(offers.externalId, itemIds)))
      : []
    const offerByItem = new Map(offerRows.map((row) => [row.externalId, row.id]))

    for (const record of chunk) {
      const current = existing.get(record.providerConversionId)
      const status = current?.status === 'paid' ? 'paid' : record.status
      const itemRows = (conversionId: string) => record.items.map((item) => ({
        conversionId, offerId: offerByItem.get(item.externalItemId) ?? null, externalItemId: item.externalItemId, itemName: item.itemName,
        quantity: item.quantity, amount: fixed(item.amount), refundAmount: fixed(item.refundAmount), commission: fixed(item.commission), itemStatus: item.status,
      }))
      summary.items += record.items.length
      summary.itemsWithoutOffer += record.items.filter((item) => !offerByItem.has(item.externalItemId)).length

      if (current) {
        const same = current.status === status && Number(current.amount) === record.amount && Number(current.commission) === record.commission
          && (current.subIds ?? null) === record.subIds && (current.buyerType ?? null) === record.buyerType
        if (same) { summary.unchanged++; continue }
        await db.transaction(async (tx) => {
          await tx.update(affiliateConversions).set({
            status, amount: fixed(record.amount), commission: fixed(record.commission), subIds: record.subIds, buyerType: record.buyerType,
            clickedAt: record.clickedAt, convertedAt: record.convertedAt, syncedAt: new Date().toISOString(),
          }).where(eq(affiliateConversions.id, current.id))
          await tx.delete(affiliateConversionItems).where(eq(affiliateConversionItems.conversionId, current.id))
          if (record.items.length) await tx.insert(affiliateConversionItems).values(itemRows(current.id))
          // Só a comissão ainda não paga acompanha a Shopee; o que já foi pago fica como foi.
          await tx.update(commissionTransactions).set({ amount: fixed(record.commission) })
            .where(and(eq(commissionTransactions.conversionId, current.id), eq(commissionTransactions.status, 'pending')))
        })
        summary.updated++
        continue
      }

      await db.transaction(async (tx) => {
        const [created] = await tx.insert(affiliateConversions).values({
          providerConversionId: record.providerConversionId, providerId, orderReferenceHash: record.orderReferenceHash,
          amount: fixed(record.amount), commission: fixed(record.commission), status,
          subIds: record.subIds, buyerType: record.buyerType, clickedAt: record.clickedAt, convertedAt: record.convertedAt,
          syncedAt: new Date().toISOString(),
        }).returning({ id: affiliateConversions.id })
        if (record.items.length) await tx.insert(affiliateConversionItems).values(itemRows(created.id))
        await tx.insert(commissionTransactions).values({ conversionId: created.id, amount: fixed(record.commission), status: 'pending' })
      })
      summary.created++
    }
  }
  return summary
}
