import { createHash } from 'node:crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
const RATE_LIMIT_CODE = 10030
const MAX_ATTEMPTS = 4

export type ShopeeProductOffer = {
  itemId: number; productName: string; priceMin: string; priceMax: string; price: string; sales: number
  ratingStar: string; imageUrl: string; offerLink: string; productLink: string; commissionRate: string
  commission: string; priceDiscountRate: number; shopName: string; shopId: number; productCatIds: number[]
}
export type ShopeePageInfo = { page: number; limit: number; hasNextPage: boolean }
export type ShopeeProductQuery = {
  keyword?: string; itemId?: number; shopId?: number; productCatId?: number
  listType?: number; sortType?: number; page?: number; limit?: number; isKeySeller?: boolean
}

export class ShopeeApiError extends Error {
  constructor(message: string, readonly code?: number, readonly status?: number) {
    super(message)
    this.name = 'ShopeeApiError'
  }
}

const productFields = 'itemId productName priceMin priceMax price sales ratingStar imageUrl offerLink productLink commissionRate commission priceDiscountRate shopName shopId productCatIds'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function credentials() {
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID
  const appSecret = process.env.SHOPEE_AFFILIATE_APP_SECRET
  if (!appId || !appSecret) throw new ShopeeApiError('Credenciais ausentes: defina SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_APP_SECRET no ambiente.')
  return { appId, appSecret }
}

/** Assina e envia uma chamada GraphQL. A assinatura cobre o corpo exato enviado. */
export async function shopeeRequest<T>(query: string, attempt = 1): Promise<T> {
  const { appId, appSecret } = credentials()
  const payload = JSON.stringify({ query })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHash('sha256').update(`${appId}${timestamp}${payload}${appSecret}`).digest('hex')
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}` },
    body: payload,
  })
  const retriable = response.status === 429 || response.status >= 500
  if (retriable && attempt < MAX_ATTEMPTS) { await sleep(2 ** attempt * 500); return shopeeRequest<T>(query, attempt + 1) }
  if (!response.ok) throw new ShopeeApiError(`A Shopee respondeu ${response.status}.`, undefined, response.status)
  const body = await response.json() as { data?: T; errors?: { message: string; extensions?: { code?: number } }[] }
  const failure = body.errors?.[0]
  if (failure) {
    const code = failure.extensions?.code
    if (code === RATE_LIMIT_CODE && attempt < MAX_ATTEMPTS) { await sleep(2 ** attempt * 1000); return shopeeRequest<T>(query, attempt + 1) }
    throw new ShopeeApiError(failure.message, code, response.status)
  }
  if (!body.data) throw new ShopeeApiError('A Shopee respondeu sem dados.', undefined, response.status)
  return body.data
}

const argList = (query: ShopeeProductQuery) => Object.entries(query)
  .filter(([, value]) => value !== undefined && value !== '')
  .map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`)
  .join(', ')

export async function fetchProductOffers(query: ShopeeProductQuery = {}) {
  const args = argList({ page: 1, limit: 50, ...query })
  const data = await shopeeRequest<{ productOfferV2: { nodes: ShopeeProductOffer[] | null; pageInfo: ShopeePageInfo } }>(
    `{ productOfferV2(${args}) { nodes { ${productFields} } pageInfo { page limit hasNextPage } } }`,
  )
  return { nodes: data.productOfferV2.nodes ?? [], pageInfo: data.productOfferV2.pageInfo }
}

/** Percorre as páginas até juntar `total` ofertas ou acabarem os resultados. */
export async function fetchAllProductOffers(query: ShopeeProductQuery, total: number, maxPages = 5) {
  const pageSize = Math.min(query.limit ?? 50, 100)
  const collected: ShopeeProductOffer[] = []
  for (let page = query.page ?? 1; page < (query.page ?? 1) + maxPages; page++) {
    const { nodes, pageInfo } = await fetchProductOffers({ ...query, page, limit: pageSize })
    collected.push(...nodes)
    if (collected.length >= total || !pageInfo.hasNextPage || !nodes.length) break
  }
  return collected.slice(0, total)
}

/** Gera um link de afiliado próprio, com etiquetas de origem (subIds) para rastrear a fonte do clique. */
export async function generateShortLink(originUrl: string, subIds: string[] = []) {
  const ids = [...subIds, '', '', '', '', ''].slice(0, 5).map((id) => JSON.stringify(id)).join(', ')
  const data = await shopeeRequest<{ generateShortLink: { shortLink: string } }>(
    `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}, subIds: [${ids}] }) { shortLink } }`,
  )
  return data.generateShortLink.shortLink
}
