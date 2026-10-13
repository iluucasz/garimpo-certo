import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons } from '@/lib/db/schema'
import { shopeeRequest } from './client'

/**
 * Campanhas oficiais da Shopee (`shopeeOfferV2`): páginas de categoria ou coleção com link de afiliado e período.
 * A API de afiliados NÃO expõe cupons de desconto nem códigos; isto é o mais próximo que ela entrega.
 */
export type ShopeeCampaign = {
  commissionRate: string
  imageUrl: string | null
  offerLink: string
  originalLink: string
  offerName: string
  offerType: number
  categoryId: number | null
  collectionId: number | null
  periodStartTime: number
  periodEndTime: number
}

const FIELDS = 'commissionRate imageUrl offerLink originalLink offerName offerType categoryId collectionId periodStartTime periodEndTime'
// A API usa 32503651199 (ano 3000) como "sem fim".
const OPEN_ENDED = 32_000_000_000

export async function fetchShopeeCampaigns(maxPages = 6, limit = 50) {
  const all: ShopeeCampaign[] = []
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    const data = await shopeeRequest<{ shopeeOfferV2: { nodes: ShopeeCampaign[]; pageInfo: { hasNextPage: boolean } } }>(
      `{ shopeeOfferV2(page: ${pageNumber}, limit: ${limit}, sortType: 1) { nodes { ${FIELDS} } pageInfo { hasNextPage } } }`,
    )
    all.push(...data.shopeeOfferV2.nodes)
    if (!data.shopeeOfferV2.pageInfo.hasNextPage) break
  }
  return all
}

const cleanName = (name: string) => name.replace(/^[\s-]+/, '').trim() || 'Campanha da Shopee'
const toIso = (seconds: number) => (seconds > 0 && seconds < OPEN_ENDED ? new Date(seconds * 1000).toISOString() : null)

/**
 * Traz as campanhas para a tabela de cupons com `source = 'shopee_campaign'`. Entram ocultas: a equipe escolhe
 * o que mostrar e pode renomear (os nomes vêm em inglês). Depois da primeira vez, a sincronização só atualiza
 * link, imagem e período, nunca o título nem a visibilidade que a equipe definiu.
 */
export async function syncShopeeCampaigns() {
  const campaigns = await fetchShopeeCampaigns()
  let created = 0
  let updated = 0
  const now = new Date().toISOString()
  for (const campaign of campaigns) {
    const externalId = `${campaign.offerType}:${campaign.categoryId ?? campaign.collectionId ?? campaign.offerLink}`
    const startsAt = toIso(campaign.periodStartTime)
    const endsAt = toIso(campaign.periodEndTime)
    const [row] = await db.insert(coupons).values({
      title: cleanName(campaign.offerName),
      description: 'Página de ofertas da Shopee com este tema.',
      url: campaign.offerLink,
      imageUrl: campaign.imageUrl,
      source: 'shopee_campaign',
      externalId,
      isActive: false,
      startsAt,
      endsAt,
      lastSyncedAt: now,
    }).onConflictDoUpdate({
      target: [coupons.source, coupons.externalId],
      set: { url: campaign.offerLink, imageUrl: campaign.imageUrl, startsAt, endsAt, lastSyncedAt: now, updatedAt: now },
    }).returning({ inserted: sql<boolean>`(xmax = 0)` })
    if (row?.inserted) created++
    else updated++
  }
  return { fetched: campaigns.length, created, updated }
}
