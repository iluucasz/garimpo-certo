import { afterAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { affiliateClicks, offers } from '@/lib/db/schema'
import { GET, POST } from '@/app/api/v1/outbound-clicks/route'

const createdClickIds: string[] = []

afterAll(async () => {
  for (const clickId of createdClickIds) await db.delete(affiliateClicks).where(eq(affiliateClicks.clickId, clickId))
})

const post = (body: unknown) => POST(new Request('http://localhost/api/v1/outbound-clicks', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))

describe('cliques em botões de compra', () => {
  it('relatório de atribuição exige permissão de analytics', async () => {
    expect((await GET(new Request('http://localhost/api/v1/outbound-clicks'))).status).toBe(401)
  })

  it('registra o clique de uma oferta real sem dados pessoais', async () => {
    const [offer] = await db.select({ id: offers.id }).from(offers).limit(1)
    const response = await post({ offerId: offer.id, slot: 'product-card', sessionId: 'sessao-de-teste' })
    expect(response.status).toBe(201)
    const { data } = await response.json()
    createdClickIds.push(data.clickId)
    const [row] = await db.select().from(affiliateClicks).where(eq(affiliateClicks.clickId, data.clickId))
    expect(row.offerId).toBe(offer.id)
    expect(row.userId).toBeNull()
    expect(row.recommendationSlotId).toBe('product-card')
  })

  it('gera a visita no servidor quando o cliente não envia', async () => {
    const [offer] = await db.select({ id: offers.id }).from(offers).limit(1)
    const response = await post({ offerId: offer.id })
    expect(response.status).toBe(201)
    createdClickIds.push((await response.json()).data.clickId)
  })

  it('recusa oferta malformada ou inexistente', async () => {
    expect((await post({ offerId: 'não-é-uuid' })).status).toBe(422)
    expect((await post({})).status).toBe(422)
    expect((await post({ offerId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404)
  })
})
