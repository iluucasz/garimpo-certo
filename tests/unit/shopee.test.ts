import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProductOffers, ShopeeApiError, shopeeRequest } from '@/lib/providers/shopee/client'
import { editorialScoreFrom, isUsableOffer, originalPriceFrom, toCatalogItem } from '@/lib/providers/shopee/mapping'
import type { ShopeeProductOffer } from '@/lib/providers/shopee/client'

const offer = (patch: Partial<ShopeeProductOffer> = {}): ShopeeProductOffer => ({
  itemId: 123, productName: 'Fone Bluetooth TWS', priceMin: '49.90', priceMax: '49.90', price: '49.90',
  sales: 1200, ratingStar: '4.8', imageUrl: 'https://cf.shopee.com.br/file/abc', offerLink: 'https://s.shopee.com.br/abc',
  productLink: 'https://shopee.com.br/product/1/123', commissionRate: '0.12', commission: '5.99',
  priceDiscountRate: 40, shopName: 'Loja Teste', shopId: 7, productCatIds: [11], ...patch,
})

const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })

describe('cliente da Shopee', () => {
  beforeEach(() => {
    process.env.SHOPEE_AFFILIATE_APP_ID = 'app-teste'
    process.env.SHOPEE_AFFILIATE_APP_SECRET = 'segredo-teste'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('assina a requisição com AppId, horário e corpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }))
    vi.stubGlobal('fetch', fetchMock)
    await shopeeRequest('{ ok }')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://open-api.affiliate.shopee.com.br/graphql')
    expect(init.headers.Authorization).toMatch(/^SHA256 Credential=app-teste, Timestamp=\d{10}, Signature=[a-f0-9]{64}$/)
    expect(init.body).toBe(JSON.stringify({ query: '{ ok }' }))
  })

  it('repete a chamada quando a Shopee responde limite de requisições', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'rate limit', extensions: { code: 10030 } }] }))
      .mockResolvedValueOnce(jsonResponse({ data: { productOfferV2: { nodes: [offer()], pageInfo: { page: 1, limit: 1, hasNextPage: false } } } }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchProductOffers({ keyword: 'fone', limit: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.nodes).toHaveLength(1)
  })

  it('propaga erro da API com o código da Shopee', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: 'sem acesso', extensions: { code: 10020 } }] })))
    await expect(shopeeRequest('{ ok }')).rejects.toMatchObject({ name: 'ShopeeApiError', code: 10020 })
  })

  it('exige credenciais configuradas', async () => {
    delete process.env.SHOPEE_AFFILIATE_APP_ID
    vi.stubGlobal('fetch', vi.fn())
    await expect(shopeeRequest('{ ok }')).rejects.toBeInstanceOf(ShopeeApiError)
  })
})

describe('mapeamento de ofertas', () => {
  it('só calcula preço cheio quando a oferta tem preço único', () => {
    expect(originalPriceFrom(100, 100, 50)).toBe(200)
    expect(originalPriceFrom(12.9, 39.89, 92)).toBeNull()
    expect(originalPriceFrom(100, 100, 0)).toBeNull()
  })

  it('separa produtos pelo índice, sem saturar tudo em nota alta', () => {
    const bom = editorialScoreFrom({ rating: 4.9, sales: 20000, discountPercentage: 40 })
    const fraco = editorialScoreFrom({ rating: 4.5, sales: 60, discountPercentage: 0 })
    expect(bom).toBeGreaterThan(fraco + 20)
    expect(bom).toBeLessThanOrEqual(100)
  })

  it('descarta oferta sem imagem, sem link ou com pouca reputação', () => {
    expect(isUsableOffer(offer())).toBe(true)
    expect(isUsableOffer(offer({ imageUrl: '' }))).toBe(false)
    expect(isUsableOffer(offer({ offerLink: '' }))).toBe(false)
    expect(isUsableOffer(offer({ ratingStar: '3.2' }))).toBe(false)
    expect(isUsableOffer(offer({ sales: 3 }))).toBe(false)
  })

  it('converte a oferta da Shopee no formato do catálogo', () => {
    const item = toCatalogItem(offer({ priceMax: '89.90' }), 'audio')
    expect(item).toMatchObject({
      externalId: '123', categorySlug: 'audio', brandName: 'Loja Teste', sellerName: 'Loja Teste',
      price: 49.9, priceMax: 89.9, originalPrice: null, soldCount: 1200, commissionRate: 0.12,
      affiliateUrl: 'https://s.shopee.com.br/abc',
    })
    expect(item.slug).toBe('fone-bluetooth-tws-123')
    expect(item.tags).toContain('Mais vendido')
    expect(item.description).toBe('Vendido por Loja Teste na Shopee.')
  })
})
