import type { listContent } from './content-store'

/** Forma enviada ao painel (sem expor colunas internas). */
export const contentView = (row: Awaited<ReturnType<typeof listContent>>[number]) => {
  const facts = (row.facts ?? {}) as Record<string, unknown>
  return {
    id: row.id, channel: row.channel, status: row.status, text: row.text, script: typeof facts.script === 'string' ? facts.script : null,
    hashtags: Array.isArray(facts.hashtags) ? facts.hashtags as string[] : [], imageUrl: row.imageUrl, linkUrl: row.linkUrl, campaign: row.campaign,
    source: row.source, name: typeof facts.name === 'string' ? facts.name : 'Produto', price: typeof facts.price === 'number' ? facts.price : null,
    productId: row.productId, scheduledFor: row.scheduledFor, publishedAt: row.sentAt, publishedUrl: typeof facts.publishedUrl === 'string' ? facts.publishedUrl : null,
    createdAt: row.createdAt,
  }
}

export type ContentItem = ReturnType<typeof contentView>
