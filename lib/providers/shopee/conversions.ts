import { createHash } from 'node:crypto'
import { shopeeRequest } from './client'
import { parseUtmContent } from './links'

/** Valores do enum `conversion_status` do banco. */
export type ConversionStatusValue = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'paid'

export type ShopeeConversionItem = {
  itemId: number | string; modelId?: number | string; itemName: string; qty: number
  actualAmount: string; refundAmount: string; itemTotalCommission: string; displayItemStatus: string; fraudStatus: string
}
export type ShopeeConversion = {
  conversionId: number | string; clickTime: number; purchaseTime: number; conversionStatus: string
  totalCommission: string; netCommission: string; estimatedTotalCommission: string
  buyerType: string; utmContent: string
  orders: { orderId: string; orderStatus: string | null; items: ShopeeConversionItem[] }[]
}

export type ConversionRecord = {
  providerConversionId: string
  status: ConversionStatusValue
  amount: number
  commission: number
  subIds: string | null
  buyerType: 'new' | 'existing' | null
  clickedAt: string | null
  convertedAt: string | null
  orderReferenceHash: string
  items: { externalItemId: string; itemName: string; quantity: number; amount: number; refundAmount: number; commission: number; status: string | null }[]
}

/** A API só consulta os últimos 3 meses (erro 11001 acima disso). */
export const MAX_LOOKBACK_DAYS = 89
const PAGE_LIMIT = 100
const MAX_PAGES = 50

const fields = `conversionId clickTime purchaseTime conversionStatus totalCommission netCommission estimatedTotalCommission buyerType utmContent
  orders { orderId orderStatus items { itemId modelId itemName qty actualAmount refundAmount itemTotalCommission displayItemStatus fraudStatus } }`

/** Percorre o relatório de conversões (paginado por `scrollId`) de um intervalo de compra, em segundos Unix. */
export async function fetchConversions(range: { start: number; end: number }) {
  const collected: ShopeeConversion[] = []
  let scrollId: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const args = [`purchaseTimeStart: ${Math.floor(range.start)}`, `purchaseTimeEnd: ${Math.floor(range.end)}`, `limit: ${PAGE_LIMIT}`]
    if (scrollId) args.push(`scrollId: ${JSON.stringify(scrollId)}`)
    const data: { conversionReport: { nodes: ShopeeConversion[] | null; pageInfo: { hasNextPage: boolean; scrollId: string | null } } } = await shopeeRequest(
      `{ conversionReport(${args.join(', ')}) { nodes { ${fields} } pageInfo { limit hasNextPage scrollId } } }`,
    )
    collected.push(...(data.conversionReport.nodes ?? []))
    const info = data.conversionReport.pageInfo
    if (!info.hasNextPage || !info.scrollId) break
    scrollId = info.scrollId
  }
  return collected
}

const money = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0
}
const iso = (seconds: unknown) => {
  const value = Number(seconds)
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null
}

export function statusFrom(conversion: Pick<ShopeeConversion, 'conversionStatus' | 'orders'>): ConversionStatusValue {
  const flagged = conversion.orders.some((order) => order.items.some((item) => /^fraud/i.test(item.fraudStatus ?? '')))
  if (flagged) return 'rejected'
  const raw = conversion.conversionStatus ?? ''
  if (/cancel/i.test(raw)) return 'cancelled'
  if (/complet|approv|valid/i.test(raw)) return 'approved'
  return 'pending'
}

/** Converte um nó do relatório da Shopee no registro que gravamos. Função pura, coberta por testes. */
export function toConversionRecord(node: ShopeeConversion): ConversionRecord {
  const items = node.orders.flatMap((order) => order.items.map((item) => ({
    externalItemId: String(item.itemId),
    itemName: String(item.itemName ?? '').slice(0, 300),
    quantity: Math.max(1, Math.trunc(Number(item.qty)) || 1),
    amount: money(item.actualAmount),
    refundAmount: money(item.refundAmount),
    commission: money(item.itemTotalCommission),
    status: item.displayItemStatus ? String(item.displayItemStatus).slice(0, 40) : null,
  })))
  const itemsCommission = Math.round(items.reduce((sum, item) => sum + item.commission, 0) * 100) / 100
  // Líquida (já sem taxa de MCN) → total → estimada → soma dos itens. Pedido pendente costuma só ter a estimada.
  const commission = money(node.netCommission) || money(node.totalCommission) || money(node.estimatedTotalCommission) || itemsCommission
  const orderIds = node.orders.map((order) => order.orderId).sort()
  const buyer = String(node.buyerType ?? '').toLowerCase()
  return {
    providerConversionId: String(node.conversionId),
    status: statusFrom(node),
    amount: Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
    commission,
    subIds: parseUtmContent(node.utmContent),
    buyerType: buyer === 'new' || buyer === 'existing' ? buyer : null,
    clickedAt: iso(node.clickTime),
    convertedAt: iso(node.purchaseTime),
    // Só o hash do(s) pedido(s) é guardado; o número do pedido não precisa ficar no nosso banco.
    orderReferenceHash: `sha256_${createHash('sha256').update(orderIds.join(',') || String(node.conversionId)).digest('hex').slice(0, 32)}`,
    items,
  }
}
