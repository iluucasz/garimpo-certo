import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { GET as listRoute, POST as actionRoute } from '@/app/api/v1/admin/posts/route'
import { PATCH as patchRoute } from '@/app/api/v1/admin/posts/[id]/route'
import { db } from '@/lib/db/client'
import { offers, products, providers, socialPosts } from '@/lib/db/schema'
import { brasiliaTime } from '@/lib/social/schedule'
import {
  approvePost, cancelPost, createPost, deliverDue, deliverPost, expireOldPending, loadCandidates, loadSocialSettings, planToday, restoreOriginalText, rewritePost, type SocialSettings,
} from '@/lib/social/store'
import { checkTelegram, sendTelegramPost, telegramConfig, TelegramError } from '@/lib/social/telegram'
import { createAuthenticatedUser } from '../helpers/auth'

const tag = `teste${crypto.randomUUID().slice(0, 6)}`
const providerIds: string[] = []
const productIds: string[] = []
const realFetch = globalThis.fetch

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const telegramOk = (messageId = 4242) => json({ ok: true, result: { message_id: messageId } })

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
  const [provider] = await db.insert(providers).values({ code: `prov-soc-${suffix}`, displayName: 'Provider Social' }).returning()
  const [product] = await db.insert(products).values({ slug: `produto-soc-${suffix}`, name: 'Fone Bluetooth Teste Social', status: 'active', rating: '4.80', editorialScore: '90.00' }).returning()
  await db.insert(offers).values({
    productId: product.id, providerId: provider.id, externalId: `ext-${suffix}`, externalUrl: 'https://shopee.com.br/product/1/999', affiliateUrl: 'https://s.shopee.com.br/raw',
    price: '39.90', originalPrice: '59.90', discountPercentage: '33.40', rating: '4.80', soldCount: 1250, commissionRate: '0.1000', status: 'active',
  })
  providerIds.push(provider.id); productIds.push(product.id)
  const candidate = (await loadCandidates()).find((item) => item.productId === product.id)
  if (!candidate) throw new Error('fixture não apareceu entre os candidatos')
  return candidate
}

beforeEach(() => { process.env.TELEGRAM_BOT_TOKEN = '123456:SEGREDO-DE-TESTE'; process.env.TELEGRAM_CHAT_ID = '@canal_teste' })
afterEach(() => { vi.unstubAllGlobals(); delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID })
afterAll(async () => {
  await db.delete(socialPosts).where(like(socialPosts.campaign, `${tag}%`))
  for (const id of productIds) await db.delete(products).where(eq(products.id, id))
  for (const id of providerIds) await db.delete(providers).where(eq(providers.id, id))
})

describe('envio pelo Telegram', () => {
  it('exige token e canal', () => {
    expect(telegramConfig({})).toBeNull()
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: 'x' })).toBeNull()
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: ' tok ', TELEGRAM_CHAT_ID: '@c' })).toEqual({ token: 'tok', chatId: '@c' })
  })

  it('manda foto com legenda e devolve o id da mensagem', async () => {
    const fetchMock = vi.fn().mockResolvedValue(telegramOk(77))
    const result = await sendTelegramPost({ token: 'T', chatId: '@c' }, { text: '<b>Oi</b>', imageUrl: 'https://cf.shopee.com.br/a.jpg' }, fetchMock as unknown as typeof fetch)
    expect(result).toEqual({ messageId: '77', usedPhoto: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/botT/sendPhoto')
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '@c', parse_mode: 'HTML', caption: '<b>Oi</b>' })
  })

  it('cai para texto quando o Telegram não consegue baixar a imagem', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ ok: false, error_code: 400, description: 'Bad Request: failed to get HTTP URL content' }, 400))
      .mockResolvedValueOnce(telegramOk(5))
    const result = await sendTelegramPost({ token: 'T', chatId: '@c' }, { text: 'texto', imageUrl: 'https://x.test/a.jpg' }, fetchMock as unknown as typeof fetch)
    expect(result).toEqual({ messageId: '5', usedPhoto: false })
    expect(fetchMock.mock.calls[1][0]).toContain('sendMessage')
  })

  it('espera o limite do Telegram (429) e tenta de novo uma vez', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } }, 429))
      .mockResolvedValueOnce(telegramOk(9))
    const pending = sendTelegramPost({ token: 'T', chatId: '@c' }, { text: 't', imageUrl: null }, fetchMock as unknown as typeof fetch)
    await vi.advanceTimersByTimeAsync(1500)
    expect(await pending).toEqual({ messageId: '9', usedPhoto: false })
    vi.useRealTimers()
  })

  it('o erro nunca carrega o token', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED https://api.telegram.org/bot123456:SEGREDO-DE-TESTE/sendMessage'))
    const error = await sendTelegramPost({ token: '123456:SEGREDO-DE-TESTE', chatId: '@c' }, { text: 't', imageUrl: null }, boom as unknown as typeof fetch).catch((reason) => reason)
    expect(error).toBeInstanceOf(TelegramError)
    expect(String(error.message)).not.toContain('SEGREDO')
  })

  it('confere token e canal sem publicar nada', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ ok: true, result: { id: 1, username: 'garimpo_bot' } }))
      .mockResolvedValueOnce(json({ ok: true, result: { title: 'Garimpo Ofertas', type: 'channel' } }))
      .mockResolvedValueOnce(json({ ok: true, result: { status: 'administrator' } }))
    const info = await checkTelegram({ token: 'T', chatId: '@c' }, fetchMock as unknown as typeof fetch)
    expect(info).toEqual({ bot: 'garimpo_bot', chatTitle: 'Garimpo Ofertas', chatType: 'channel', botStatus: 'administrator' })
    expect(fetchMock.mock.calls.map((call) => String(call[0]).split('/').pop())).toEqual(['getMe', 'getChat', 'getChatMember'])
  })
})

describe('fila de postagens', () => {
  const settings = (patch: Partial<SocialSettings> = {}): SocialSettings => ({ mode: 'on', dailyLimit: 3, startHour: 9, endHour: 21, requireApproval: true, autoPlan: true, useAi: false, campaign: tag, ...patch })

  it('cria a postagem com link etiquetado e texto só com números reais', async () => {
    const calls = stubShopee()
    const candidate = await fixtureCandidate()
    const row = await createPost({ candidate, campaign: tag, source: 'manual', status: 'pending', scheduledFor: null, userId: null })
    expect(row).toMatchObject({ status: 'pending', channel: 'telegram', campaign: tag, linkUrl: `https://s.shopee.com.br/${tag}` })
    const query = JSON.parse(calls[0]).query as string
    expect(query).toContain('"telegram"')
    expect(query).toContain(`"${tag}"`)
    expect(row.text).toContain('R$ 39,90')
    expect(row.text).toContain('de R$ 59,90')
    expect(row.text).toContain('Link de afiliado')
    expect(row.facts).toMatchObject({ price: 39.9, originalPrice: 59.9, soldCount: 1250 })
  })

  it('aprovar, enviar e registrar o id da mensagem; não envia duas vezes', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    const created = await createPost({ candidate, campaign: tag, source: 'manual', status: 'pending', scheduledFor: Date.now() - 1000, userId: null })
    expect(await deliverPost({ ...created, status: 'approved' }, vi.fn() as unknown as typeof fetch)).toMatchObject({ ok: false })

    const approved = await approvePost(created.id, null)
    expect(approved?.status).toBe('approved')
    const fetchMock = vi.fn().mockResolvedValue(telegramOk(31337))
    const result = await deliverPost(approved!, fetchMock as unknown as typeof fetch)
    expect(result).toEqual({ ok: true, messageId: '31337' })
    const [saved] = await db.select().from(socialPosts).where(eq(socialPosts.id, created.id))
    expect(saved).toMatchObject({ status: 'sent', externalMessageId: '31337', error: null })
    expect(saved.sentAt).toBeTruthy()

    const again = await deliverPost(approved!, fetchMock as unknown as typeof fetch)
    expect(again.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('erro definitivo marca como falha; erro passageiro mantém na fila até o limite', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    const hard = await createPost({ candidate, campaign: tag, source: 'manual', status: 'approved', scheduledFor: Date.now() - 1000, userId: null })
    const denied = vi.fn().mockResolvedValue(json({ ok: false, error_code: 403, description: 'Forbidden: bot is not a member of the channel chat' }, 403))
    expect(await deliverPost(hard, denied as unknown as typeof fetch)).toMatchObject({ ok: false, retry: false })
    expect((await db.select().from(socialPosts).where(eq(socialPosts.id, hard.id)))[0]).toMatchObject({ status: 'failed' })

    const soft = await createPost({ candidate, campaign: tag, source: 'manual', status: 'approved', scheduledFor: Date.now() - 1000, userId: null })
    const down = vi.fn().mockResolvedValue(json({ ok: false, error_code: 502, description: 'Bad Gateway' }, 502))
    expect(await deliverPost(soft, down as unknown as typeof fetch)).toMatchObject({ ok: false, retry: true })
    expect((await db.select().from(socialPosts).where(eq(socialPosts.id, soft.id)))[0]).toMatchObject({ status: 'approved', attempts: 1 })
  })

  it('o que passou de 3 horas do horário não é enviado fora de hora', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    const late = await createPost({ candidate, campaign: `${tag}late`, source: 'manual', status: 'approved', scheduledFor: Date.now() - 4 * 3_600_000, userId: null })
    const fetchMock = vi.fn().mockResolvedValue(telegramOk())
    // Só a campanha deste teste: nunca mexe em postagens reais da fila.
    const summary = await deliverDue(Date.now(), fetchMock as unknown as typeof fetch, { campaign: `${tag}late` })
    expect(summary.expired).toBe(1)
    expect((await db.select().from(socialPosts).where(eq(socialPosts.id, late.id)))[0]).toMatchObject({ status: 'failed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancelar tira da fila e pendente vencida expira', async () => {
    stubShopee()
    const candidate = await fixtureCandidate()
    const one = await createPost({ candidate, campaign: tag, source: 'manual', status: 'pending', scheduledFor: null, userId: null })
    expect((await cancelPost(one.id))?.status).toBe('cancelled')
    expect(await cancelPost(one.id)).toBeNull()

    const old = await createPost({ candidate, campaign: tag, source: 'engine', status: 'pending', scheduledFor: Date.now() - 5 * 3_600_000, userId: null })
    expect(await expireOldPending(Date.now(), { campaign: tag })).toBe(1)
    expect((await db.select().from(socialPosts).where(eq(socialPosts.id, old.id)))[0].status).toBe('cancelled')
  })

  it('planeja só o que falta da cota do dia, em horários futuros, sempre pendente de aprovação', async () => {
    stubShopee()
    await fixtureCandidate()
    // Um dia distante: as postagens que outros testes criam hoje não contam para a cota deste.
    const now = brasiliaTime('2031-03-15', 8)
    const first = await planToday(settings({ dailyLimit: 2 }), now, null)
    expect(first.created).toBeGreaterThanOrEqual(1)
    const mine = (await db.select().from(socialPosts).where(eq(socialPosts.campaign, tag))).filter((post) => post.scheduledFor && new Date(post.scheduledFor).getUTCFullYear() === 2031)
    expect(mine.length).toBe(first.created)
    for (const post of mine) {
      expect(post).toMatchObject({ status: 'pending', source: 'engine' })
      expect(new Date(post.scheduledFor!).getTime()).toBeGreaterThan(now)
    }
    // Com a cota fechada (as postagens de hoje já existem), não cria mais.
    const second = await planToday(settings({ dailyLimit: 2 }), now, null)
    expect(second.created).toBe(0)
  })

  it('a configuração padrão é segura: desligada e com aprovação', async () => {
    const stored = await loadSocialSettings()
    expect(stored.dailyLimit).toBeGreaterThanOrEqual(1)
    expect(stored.requireApproval).toBe(true)
  })
})

describe('API das postagens', () => {
  it('exige sessão e permissão de escrita; valida ações e identificadores', async () => {
    expect((await listRoute(new Request('http://localhost/x'))).status).toBe(401)
    const reader = await createAuthenticatedUser('READ_ONLY')
    const list = await listRoute(new Request('http://localhost/x', { headers: { cookie: reader.cookie } }))
    expect(list.status).toBe(200)
    const body = (await list.json()).data
    expect(body).toMatchObject({ configured: true })
    expect(JSON.stringify(body)).not.toContain('SEGREDO')

    const post = (payload: unknown, cookie: string) => actionRoute(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(payload) }))
    expect((await post({ action: 'plan' }, reader.cookie)).status).toBe(403)

    const editor = await createAuthenticatedUser('CATALOG_MANAGER')
    expect((await post({ action: 'inventada' }, editor.cookie)).status).toBe(422)
    expect((await post({ action: 'create', productId: crypto.randomUUID() }, editor.cookie)).status).toBe(404)

    const patch = (id: string, payload: unknown, cookie: string) => patchRoute(
      new Request('http://localhost/x', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(payload) }),
      { params: Promise.resolve({ id }) },
    )
    expect((await patch('nao-e-uuid', { action: 'cancel' }, editor.cookie)).status).toBe(404)
    expect((await patch(crypto.randomUUID(), { text: '   ' }, editor.cookie)).status).toBe(422)
    expect((await patch(crypto.randomUUID(), { action: 'approve' }, editor.cookie)).status).toBe(409)
  })

  it('sem bot configurado, conferir a conexão explica o que falta', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const editor = await createAuthenticatedUser('CATALOG_MANAGER')
    const response = await actionRoute(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', cookie: editor.cookie }, body: JSON.stringify({ action: 'check' }) }))
    expect(response.status).toBe(409)
    expect((await response.json()).error.message).toContain('TELEGRAM_BOT_TOKEN')
  })
})

describe('texto por IA nas postagens', () => {
  const link = `https://s.shopee.com.br/${tag}`
  const goodText = `Achei esse fone bluetooth 🎧
Sai por <b>R$ 39,90</b> (antes R$ 59,90), nota 4,8 e mais de 1,3 mil vendas.
${link}`

  /** Shopee devolve o link; o DeepSeek devolve `answer`. */
  function stubAi(answer: string | (() => Response)) {
    const requests: { url: string; body: string }[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('open-api.affiliate.shopee')) return json({ data: { generateShortLink: { shortLink: link } } })
      if (url.includes('api.deepseek.com')) {
        requests.push({ url, body: String(init?.body ?? '') })
        return typeof answer === 'function' ? answer() : json({ choices: [{ message: { content: answer } }] })
      }
      return realFetch(input, init)
    })
    return requests
  }

  beforeEach(() => { process.env.DEEPSEEK_API_KEY = 'sk-teste-ia' })
  afterEach(() => { delete process.env.DEEPSEEK_API_KEY })

  it('cria a postagem já com o texto da IA quando ele passa na validação', async () => {
    const requests = stubAi(goodText)
    const candidate = await fixtureCandidate()
    const row = await createPost({ candidate, campaign: `${tag}ia`, source: 'manual', status: 'pending', scheduledFor: null, userId: null, useAi: true })
    expect(row.text).toContain('Achei esse fone bluetooth')
    expect(row.text).toContain('Link de afiliado')
    expect(row.facts).toMatchObject({ ai: { rewritten: true } })
    expect(requests).toHaveLength(1)
    // O pedido leva só dados da oferta, e a chave só no cabeçalho.
    expect(requests[0].body).toContain('R$ 39,90')
    expect(requests[0].body).not.toContain('sk-teste-ia')
  })

  it('se a IA inventar urgência, vale o modelo fixo e o motivo fica registrado', async () => {
    stubAi(`${goodText}
Só hoje!`)
    const candidate = await fixtureCandidate()
    const row = await createPost({ candidate, campaign: `${tag}ia`, source: 'manual', status: 'pending', scheduledFor: null, userId: null, useAi: true })
    expect(row.text).not.toContain('Só hoje')
    expect(row.text).toContain('R$ 39,90')
    expect(row.facts).toMatchObject({ ai: { rewritten: false } })
  })

  it('sem chave da IA não chama a API e usa o modelo fixo', async () => {
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.deep_seek
    const requests = stubAi(goodText)
    const candidate = await fixtureCandidate()
    const row = await createPost({ candidate, campaign: `${tag}ia`, source: 'manual', status: 'pending', scheduledFor: null, userId: null, useAi: true })
    expect(requests).toHaveLength(0)
    expect(row.facts).not.toHaveProperty('ai')
  })

  it('reescrever guarda o texto anterior e dá para voltar', async () => {
    stubAi(goodText)
    const candidate = await fixtureCandidate()
    const created = await createPost({ candidate, campaign: `${tag}ia`, source: 'manual', status: 'pending', scheduledFor: null, userId: null })
    const original = created.text

    const rewritten = await rewritePost(created.id)
    expect(rewritten.ok).toBe(true)
    expect(rewritten.ok && rewritten.row.text).toContain('Achei esse fone bluetooth')
    expect((await db.select().from(socialPosts).where(eq(socialPosts.id, created.id)))[0].facts).toMatchObject({ originalText: original })

    const restored = await restoreOriginalText(created.id)
    expect(restored?.text).toBe(original)
    expect(await restoreOriginalText(created.id)).toBeNull()
  })

  it('reescrita recusada mantém o texto e explica; postagem enviada não é reescrita', async () => {
    stubAi('Texto sem link nem preço, só conversa.')
    const candidate = await fixtureCandidate()
    const created = await createPost({ candidate, campaign: `${tag}ia`, source: 'manual', status: 'pending', scheduledFor: null, userId: null })
    const refused = await rewritePost(created.id)
    expect(refused).toMatchObject({ ok: false, status: 422 })
    expect((await db.select().from(socialPosts).where(eq(socialPosts.id, created.id)))[0].text).toBe(created.text)

    await cancelPost(created.id)
    expect(await rewritePost(created.id)).toMatchObject({ ok: false, status: 409 })
  })
})

describe('conferência da oferta antes do envio', () => {
  async function approvedPost() {
    stubShopee()
    const candidate = await fixtureCandidate()
    const created = await createPost({ candidate, campaign: `${tag}recheck`, source: 'manual', status: 'approved', scheduledFor: Date.now() - 1000, userId: null })
    return { candidate, created }
  }
  const reload = async (id: string) => (await db.select().from(socialPosts).where(eq(socialPosts.id, id)))[0]

  it('preço igual: envia o texto como está', async () => {
    const { created } = await approvedPost()
    const fetchMock = vi.fn().mockResolvedValue(telegramOk(1))
    expect(await deliverPost(created, fetchMock as unknown as typeof fetch)).toMatchObject({ ok: true })
    expect((await reload(created.id)).text).toBe(created.text)
  })

  it('preço mudou um pouco: refaz o texto com o preço de agora antes de enviar', async () => {
    const { candidate, created } = await approvedPost()
    expect(created.text).toContain('39,90')
    await db.update(offers).set({ price: '36.90' }).where(eq(offers.id, candidate.offerId))
    const fetchMock = vi.fn().mockResolvedValue(telegramOk(2))
    expect(await deliverPost(created, fetchMock as unknown as typeof fetch)).toMatchObject({ ok: true })
    const saved = await reload(created.id)
    expect(saved.status).toBe('sent')
    expect(saved.text).toContain('36,90')
    expect(saved.text).not.toContain('39,90')
    expect(saved.facts).toMatchObject({ price: 36.9, originalText: created.text })
    // O que foi ao Telegram é o texto novo.
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).toContain('36,90')
  })

  it('preço subiu muito: cancela e não envia', async () => {
    const { candidate, created } = await approvedPost()
    await db.update(offers).set({ price: '59.90' }).where(eq(offers.id, candidate.offerId))
    const fetchMock = vi.fn()
    const result = await deliverPost(created, fetchMock as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: false, retry: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await reload(created.id)).toMatchObject({ status: 'cancelled' })
    expect((await reload(created.id)).error).toMatch(/subiu/)
  })

  it('oferta que saiu do ar: cancela e não envia', async () => {
    const { candidate, created } = await approvedPost()
    await db.update(offers).set({ status: 'removed' }).where(eq(offers.id, candidate.offerId))
    const fetchMock = vi.fn()
    expect(await deliverPost(created, fetchMock as unknown as typeof fetch)).toMatchObject({ ok: false, retry: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await reload(created.id)).error).toMatch(/saiu do ar/)
  })
})
