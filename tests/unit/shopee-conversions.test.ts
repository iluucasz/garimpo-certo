import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchConversions, MAX_LOOKBACK_DAYS, statusFrom, toConversionRecord, type ShopeeConversion } from '@/lib/providers/shopee/conversions'
import { channelOf, detailOf, parseUtmContent, siteSubIds, subIdsKey, toSubId } from '@/lib/providers/shopee/links'
import { resolveAffiliateLink } from '@/lib/db/repositories/catalog-import'

const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })

const conversion = (patch: Partial<ShopeeConversion> = {}): ShopeeConversion => ({
  conversionId: 9001, clickTime: 1_760_000_000, purchaseTime: 1_760_003_600, conversionStatus: 'COMPLETED',
  totalCommission: '12.50', netCommission: '12.00', estimatedTotalCommission: '13.00',
  buyerType: 'NEW', utmContent: 'site-tecnologia---',
  orders: [{
    orderId: '2510AAA111', orderStatus: 'COMPLETED',
    items: [
      { itemId: 111, itemName: 'Fone Bluetooth', qty: 2, actualAmount: '80.00', refundAmount: '0', itemTotalCommission: '8.00', displayItemStatus: 'Completed', fraudStatus: 'VERIFIED' },
      { itemId: 222, itemName: 'Capinha', qty: 1, actualAmount: '20.00', refundAmount: '0', itemTotalCommission: '4.00', displayItemStatus: 'Completed', fraudStatus: 'VERIFIED' },
    ],
  }],
  ...patch,
})

describe('etiquetas (sub ids)', () => {
  it('aceita só letras e números, como a Shopee exige', () => {
    expect(toSubId('bem-estar')).toBe('bemestar')
    expect(toSubId('Eletrodomésticos')).toBe('eletrodomesticos')
    expect(toSubId('a_b c')).toBe('abc')
    expect(toSubId('x'.repeat(80))).toHaveLength(30)
  })

  it('monta canal e categoria para os links do site', () => {
    expect(siteSubIds('bem-estar')).toEqual(['site', 'bemestar'])
    expect(siteSubIds('---')).toEqual(['site', 'geral'])
    expect(subIdsKey(siteSubIds('games'))).toBe('site-games')
  })

  it('lê o utm_content que a Shopee devolve com as etiquetas vazias no fim', () => {
    expect(parseUtmContent('site-tecnologia---')).toBe('site-tecnologia')
    expect(parseUtmContent('telegram----')).toBe('telegram')
    expect(parseUtmContent('')).toBeNull()
    expect(parseUtmContent('----')).toBeNull()
    expect(parseUtmContent(undefined)).toBeNull()
  })

  it('separa canal e categoria/campanha', () => {
    expect(channelOf('site-tecnologia')).toBe('site')
    expect(detailOf('site-tecnologia')).toBe('tecnologia')
    expect(channelOf(null)).toBe('sem-origem')
    expect(detailOf('telegram')).toBeNull()
  })
})

describe('relatório de conversões da Shopee', () => {
  it('converte uma conversão concluída em registro do banco', () => {
    const record = toConversionRecord(conversion())
    expect(record).toMatchObject({
      providerConversionId: '9001', status: 'approved', amount: 100, commission: 12, subIds: 'site-tecnologia', buyerType: 'new',
    })
    expect(record.items).toHaveLength(2)
    expect(record.items[0]).toMatchObject({ externalItemId: '111', quantity: 2, amount: 80, commission: 8 })
    expect(record.clickedAt).toBe(new Date(1_760_000_000 * 1000).toISOString())
    expect(record.convertedAt).toBe(new Date(1_760_003_600 * 1000).toISOString())
  })

  it('guarda só o hash do pedido, nunca o número', () => {
    const record = toConversionRecord(conversion())
    expect(record.orderReferenceHash).toMatch(/^sha256_[a-f0-9]{32}$/)
    expect(JSON.stringify(record)).not.toContain('2510AAA111')
    expect(toConversionRecord(conversion()).orderReferenceHash).toBe(record.orderReferenceHash)
  })

  it('usa a comissão estimada enquanto o pedido está pendente', () => {
    const pending = toConversionRecord(conversion({ conversionStatus: 'PENDING', netCommission: '0', totalCommission: '0', estimatedTotalCommission: '9.75' }))
    expect(pending.status).toBe('pending')
    expect(pending.commission).toBe(9.75)
  })

  it('cai na soma dos itens quando a conversão não traz total', () => {
    const record = toConversionRecord(conversion({ netCommission: '0', totalCommission: '0', estimatedTotalCommission: '0' }))
    expect(record.commission).toBe(12)
  })

  it('classifica cancelamento e fraude', () => {
    expect(statusFrom(conversion({ conversionStatus: 'CANCELLED' }))).toBe('cancelled')
    const fraud = conversion()
    fraud.orders[0].items[0].fraudStatus = 'FRAUD'
    expect(statusFrom(fraud)).toBe('rejected')
    expect(statusFrom(conversion({ conversionStatus: 'PENDING' }))).toBe('pending')
  })

  it('trata origem ausente e comprador desconhecido', () => {
    const record = toConversionRecord(conversion({ utmContent: '', buyerType: 'ALL' }))
    expect(record.subIds).toBeNull()
    expect(record.buyerType).toBeNull()
  })

  it('limita a janela ao que a API aceita (3 meses)', () => {
    expect(MAX_LOOKBACK_DAYS).toBeLessThan(92)
  })
})

describe('busca paginada do relatório', () => {
  beforeEach(() => {
    process.env.SHOPEE_AFFILIATE_APP_ID = 'app-teste'
    process.env.SHOPEE_AFFILIATE_APP_SECRET = 'segredo-teste'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('segue o scrollId até acabarem as páginas', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { conversionReport: { nodes: [conversion({ conversionId: 1 })], pageInfo: { hasNextPage: true, scrollId: 'abc' } } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { conversionReport: { nodes: [conversion({ conversionId: 2 })], pageInfo: { hasNextPage: false, scrollId: null } } } }))
    vi.stubGlobal('fetch', fetchMock)
    const nodes = await fetchConversions({ start: 1000, end: 2000 })
    expect(nodes.map((node) => node.conversionId)).toEqual([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).query as string
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).query as string
    expect(first).toContain('purchaseTimeStart: 1000')
    expect(first).not.toContain('scrollId:')
    expect(second).toContain('scrollId: "abc"')
  })

  it('devolve lista vazia quando não há conversões', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { conversionReport: { nodes: [], pageInfo: { hasNextPage: false, scrollId: null } } } })))
    expect(await fetchConversions({ start: 1, end: 2 })).toEqual([])
  })
})

describe('link de afiliado com etiqueta', () => {
  const item = { externalUrl: 'https://shopee.com.br/product/1/2', affiliateUrl: 'https://s.shopee.com.br/bruto', categorySlug: 'bem-estar' }

  beforeEach(() => {
    process.env.SHOPEE_AFFILIATE_APP_ID = 'app-teste'
    process.env.SHOPEE_AFFILIATE_APP_SECRET = 'segredo-teste'
    delete process.env.SHOPEE_TAGGED_LINKS
  })
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.SHOPEE_TAGGED_LINKS })

  it('gera o link com canal e categoria quando a oferta ainda não tem etiqueta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/novo' } } }))
    vi.stubGlobal('fetch', fetchMock)
    const link = await resolveAffiliateLink(item)
    expect(link).toEqual({ url: 'https://s.shopee.com.br/novo', subIds: 'site-bemestar' })
    const query = JSON.parse(fetchMock.mock.calls[0][1].body).query as string
    expect(query).toContain('"site"')
    expect(query).toContain('"bemestar"')
  })

  it('reaproveita o link já etiquetado sem chamar a API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const link = await resolveAffiliateLink(item, { affiliateUrl: 'https://s.shopee.com.br/ja', affiliateSubIds: 'site-bemestar' })
    expect(link).toEqual({ url: 'https://s.shopee.com.br/ja', subIds: 'site-bemestar' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('regera quando a etiqueta mudou (produto trocou de categoria)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/outro' } } })))
    const link = await resolveAffiliateLink(item, { affiliateUrl: 'https://s.shopee.com.br/ja', affiliateSubIds: 'site-games' })
    expect(link).toEqual({ url: 'https://s.shopee.com.br/outro', subIds: 'site-bemestar' })
  })

  it('cai no link bruto da API quando a geração falha, sem derrubar a importação', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: 'sem acesso', extensions: { code: 10020 } }] })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const link = await resolveAffiliateLink(item)
    expect(link).toEqual({ url: 'https://s.shopee.com.br/bruto', subIds: null })
  })

  it('mantém o link etiquetado antigo se a regeração falhar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: 'falhou', extensions: { code: 10020 } }] })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const link = await resolveAffiliateLink(item, { affiliateUrl: 'https://s.shopee.com.br/ja', affiliateSubIds: 'site-games' })
    expect(link).toEqual({ url: 'https://s.shopee.com.br/ja', subIds: 'site-games' })
  })

  it('respeita o interruptor SHOPEE_TAGGED_LINKS=0', async () => {
    process.env.SHOPEE_TAGGED_LINKS = '0'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await resolveAffiliateLink(item)).toEqual({ url: 'https://s.shopee.com.br/bruto', subIds: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
