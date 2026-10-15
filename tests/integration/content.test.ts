import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { GET as listRoute, POST as actionRoute } from '@/app/api/v1/admin/content/route'
import { PATCH as patchRoute } from '@/app/api/v1/admin/content/[id]/route'
import { db } from '@/lib/db/client'
import { offers, products, providers, socialPosts } from '@/lib/db/schema'
import { cancelContent, createContentPost, getContent, loadContentSettings, markPublished, updateContent } from '@/lib/social/content-store'
import { deliverDue, expireOldPending, loadCandidates } from '@/lib/social/store'
import { createAuthenticatedUser } from '../helpers/auth'

const tag = `teste${crypto.randomUUID().slice(0, 6)}`
const providerIds: string[] = []
const productIds: string[] = []
const realFetch = globalThis.fetch
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Responde a Shopee (link com etiqueta) e deixa o resto passar. */
function stubShopee() {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('open-api.affiliate.shopee')) {
      calls.push(String(init?.body ?? ''))
      return json({ data: { generateShortLink: { shortLink: `https://s.shopee.com.br/${tag}` } } })
    }
    return realFetch(input, init)
  })
  return calls
}

async function fixtureCandidate() {
  const suffix = crypto.randomUUID().slice(0, 8)
  const [provider] = await db.insert(providers).values({ code: `prov-cnt-${suffix}`, displayName: 'Provider Conteúdo' }).returning()
  const [product] = await db.insert(products).values({ slug: `produto-cnt-${suffix}`, name: 'Fone Bluetooth Teste Conteúdo', status: 'active', rating: '4.80', editorialScore: '90.00' }).returning()
  await db.insert(offers).values({
    productId: product.id, providerId: provider.id, externalId: `ext-${suffix}`, externalUrl: 'https://shopee.com.br/product/1/999', affiliateUrl: 'https://s.shopee.com.br/raw',
    price: '39.90', originalPrice: '59.90', discountPercentage: '33.40', rating: '4.80', soldCount: 1250, commissionRate: '0.1000', status: 'active',
  })
  providerIds.push(provider.id); productIds.push(product.id)
  const candidate = (await loadCandidates('instagram')).find((item) => item.productId === product.id)
  if (!candidate) throw new Error('fixture não apareceu entre os candidatos')
  return candidate
}

afterEach(() => { vi.unstubAllGlobals() })
afterAll(async () => {
  await db.delete(socialPosts).where(like(socialPosts.campaign, `${tag}%`))
  for (const id of productIds) await db.delete(products).where(eq(products.id, id))
  for (const id of providerIds) await db.delete(providers).where(eq(providers.id, id))
})

describe('conteúdo de Instagram e TikTok', () => {
  it('cria com link etiquetado pelo canal, legenda com números reais e roteiro no TikTok', async () => {
    const calls = stubShopee()
    const candidate = await fixtureCandidate()
    const settings = { ...(await loadContentSettings()), campaign: tag }

    const insta = await createContentPost({ candidate, channel: 'instagram', settings, source: 'manual', scheduledFor: null, userId: null })
    expect(insta.channel).toBe('instagram')
    expect(insta.status).toBe('pending')
    expect(insta.linkUrl).toBe(`https://s.shopee.com.br/${tag}`)
    expect(insta.text).toContain('R$ 39,90')
    expect(calls[0]).toContain('instagram')
    expect(calls[0]).toContain(tag)

    const tiktok = await createContentPost({ candidate, channel: 'tiktok', settings, source: 'manual', scheduledFor: null, userId: null })
    expect(calls[1]).toContain('tiktok')
    expect((tiktok.facts as { script?: string }).script).toContain('Formato')
    expect((insta.facts as { script?: string }).script).toBeUndefined()
  })

  it('edita, marca como publicado e cancela apenas o que ainda não foi publicado', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    const settings = { ...(await loadContentSettings()), campaign: tag }
    const row = await createContentPost({ candidate, channel: 'instagram', settings, source: 'manual', scheduledFor: null, userId: null })

    const edited = await updateContent(row.id, { text: 'Legenda nova R$ 39,90' })
    expect(edited?.text).toBe('Legenda nova R$ 39,90')

    const published = await markPublished(row.id, null, 'https://instagram.com/p/abc')
    expect(published?.status).toBe('sent')
    expect((published?.facts as { publishedUrl?: string }).publishedUrl).toBe('https://instagram.com/p/abc')
    expect(await updateContent(row.id, { text: 'depois de publicado' })).toBeNull()
    expect(await cancelContent(row.id)).toBeNull()
    expect((await getContent(row.id))?.status).toBe('sent')
  })

  it('o envio do Telegram nunca encosta no conteúdo de Instagram e TikTok', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    const settings = { ...(await loadContentSettings()), campaign: tag }
    const row = await createContentPost({ candidate, channel: 'tiktok', settings, source: 'manual', scheduledFor: Date.now() - 5 * 3_600_000, userId: null })
    // Mesmo "aprovado" e vencido, o envio do Telegram e a limpeza de pendentes ignoram outros canais.
    await db.update(socialPosts).set({ status: 'approved' }).where(eq(socialPosts.id, row.id))
    process.env.TELEGRAM_BOT_TOKEN = '123456:SEGREDO'
    process.env.TELEGRAM_CHAT_ID = '@canal'
    try {
      const summary = await deliverDue(Date.now(), fetch, { campaign: tag })
      expect(summary).toEqual({ sent: 0, failed: 0, expired: 0 })
    } finally {
      delete process.env.TELEGRAM_BOT_TOKEN
      delete process.env.TELEGRAM_CHAT_ID
    }
    await db.update(socialPosts).set({ status: 'pending' }).where(eq(socialPosts.id, row.id))
    expect(await expireOldPending(Date.now(), { campaign: tag })).toBe(0)
    expect((await getContent(row.id))?.status).toBe('pending')
  })

  it('rotas: exige papel, cria por produto e marca como publicado', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    expect((await listRoute(new Request('http://localhost/x'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    const list = await listRoute(new Request('http://localhost/x', { headers: { cookie: reader.cookie } }))
    expect(list.status).toBe(200)
    const denied = await actionRoute(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', cookie: reader.cookie }, body: JSON.stringify({ action: 'plan' }) }))
    expect(denied.status).toBe(403)

    const editor = await createAuthenticatedUser('CATALOG_MANAGER')
    const created = await actionRoute(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', cookie: editor.cookie }, body: JSON.stringify({ action: 'create', productId: candidate.productId, channel: 'instagram' }) }))
    expect(created.status).toBe(201)
    const item = (await created.json()).data as { id: string; channel: string; status: string }
    expect(item.channel).toBe('instagram')
    await db.update(socialPosts).set({ campaign: `${tag}route` }).where(eq(socialPosts.id, item.id))

    const patch = (payload: unknown) => patchRoute(
      new Request('http://localhost/x', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: editor.cookie }, body: JSON.stringify(payload) }),
      { params: Promise.resolve({ id: item.id }) },
    )
    expect((await patch({ action: 'published', url: 'http://inseguro.test' })).status).toBe(422)
    const done = await patch({ action: 'published', url: 'https://www.instagram.com/p/xyz' })
    expect(done.status).toBe(200)
    expect(((await done.json()).data as { status: string }).status).toBe('sent')
    expect((await patch({ action: 'cancel' })).status).toBe(409)
  })
})
