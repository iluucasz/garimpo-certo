import { salesLabel } from '@/lib/catalog/rules'

/**
 * Texto das postagens (Telegram, formato HTML). Tudo sai de números reais da oferta: preço, nota, vendas e,
 * só quando a Shopee informou o preço anterior, o desconto. Nunca inventa urgência, escassez nem depoimento.
 * Várias formas de escrever, escolhidas pelo produto, para o canal não soar repetido.
 */

export type PostFacts = {
  name: string
  price: number
  /** Preço anterior informado pela Shopee, ou null. Sem ele não há "de/por". */
  originalPrice: number | null
  discountPercent: number | null
  rating: number
  soldCount: number
}

export const CAPTION_LIMIT = 1024
export const MESSAGE_LIMIT = 4096

export const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Nome do produto sem a gritaria típica dos anúncios: espaços colapsados, caixa alta suavizada, tamanho limitado. */
export function cleanTitle(raw: string, max = 90) {
  let title = raw.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').replace(/[|•]+/g, '-').trim()
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, '')
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '').length
  if (letters.length > 8 && upper / letters.length > 0.6) title = title.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_, start: string, letter: string) => `${start}${letter.toUpperCase()}`)
  if (title.length <= max) return title
  const cut = title.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : cut.length).replace(/[\s,.;:-]+$/, '')}…`
}

/** Linha de preço: "de/por" só com preço anterior real e queda de pelo menos 5%. */
export function priceLine(facts: PostFacts) {
  if (facts.originalPrice && facts.originalPrice > facts.price && (facts.discountPercent ?? 0) >= 5) {
    return `de ${money(facts.originalPrice)} por <b>${money(facts.price)}</b> (−${Math.round(facts.discountPercent ?? 0)}%)`
  }
  return `<b>${money(facts.price)}</b>`
}

/** "Nota 4,8 · 1,2 mil vendas": só o que existe. A API da Shopee não informa quantidade de avaliações. */
export function proofLine(facts: PostFacts) {
  const parts: string[] = []
  if (facts.rating > 0) parts.push(`Nota ${facts.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`)
  if (facts.soldCount >= 50) parts.push(`${salesLabel(facts.soldCount)} vendas`)
  return parts.join(' · ')
}

type Template = (parts: { title: string; price: string; proof: string; link: string }) => string

const templates: Template[] = [
  ({ title, price, proof, link }) => `<b>${title}</b>\n${price}${proof ? `\n${proof}` : ''}\n\n👉 Ver na Shopee: ${link}`,
  ({ title, price, proof, link }) => `Achado do dia 🔎\n<b>${title}</b>\n${price}${proof ? ` · ${proof}` : ''}\n${link}`,
  ({ title, price, proof, link }) => `${price}\n<b>${title}</b>${proof ? `\n${proof}` : ''}\n\nOferta aqui: ${link}`,
  ({ title, price, proof, link }) => `Separei este 👇\n<b>${title}</b>\n${price}${proof ? `\n${proof}` : ''}\n${link}`,
  ({ title, price, proof, link }) => `<b>${title}</b>\n${proof ? `${proof}\n` : ''}${price}\n\nLink: ${link}`,
]

/** Número estável a partir do texto: o mesmo produto sempre cai no mesmo modelo, produtos diferentes variam. */
export function pick(seed: string, length: number) {
  let hash = 0
  for (let index = 0; index < seed.length; index++) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  return hash % length
}

export function composePost(facts: PostFacts, linkUrl: string, seed: string, options: { caption?: boolean } = {}) {
  const limit = options.caption ? CAPTION_LIMIT : MESSAGE_LIMIT
  const index = pick(seed, templates.length)
  const build = (maxTitle: number) => {
    const body = templates[index]({
      title: escapeHtml(cleanTitle(facts.name, maxTitle)),
      price: priceLine(facts),
      proof: proofLine(facts),
      link: escapeHtml(linkUrl),
    })
    return body
  }
  let text = build(90)
  // O título é a única parte elástica; encurta até caber no limite do Telegram.
  for (let max = 70; text.length > limit && max >= 20; max -= 10) text = build(max)
  return { text, template: index }
}
