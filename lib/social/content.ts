import { salesLabel } from '@/lib/catalog/rules'
import { cleanTitle, pick, type PostFacts } from './compose'

/**
 * Conteúdo para Instagram e TikTok (texto simples, sem HTML). Pronto para o dono publicar à mão: legenda, roteiro
 * curto, hashtags e o que escrever na tela. Tudo sai de números reais da oferta (preço, nota, vendas e, só quando
 * a Shopee informou o preço anterior, o desconto). Nunca inventa benefício, urgência, escassez nem depoimento:
 * o roteiro só orienta o que mostrar, sem afirmar nada sobre o produto que não esteja nos dados.
 * Sem imports do Next: o worker da VPS usa este arquivo.
 */

export type ContentChannel = 'instagram' | 'tiktok'
export const contentChannels: ContentChannel[] = ['instagram', 'tiktok']
export const channelLabel: Record<ContentChannel, string> = { instagram: 'Instagram', tiktok: 'TikTok' }
export const isContentChannel = (value: unknown): value is ContentChannel => value === 'instagram' || value === 'tiktok'

/** Limites das plataformas para legenda (com folga): Instagram 2.200 caracteres; TikTok aceita 2.200 hoje. */
export const CONTENT_LIMIT = 2200
const INSTAGRAM_TAGS = 10
const TIKTOK_TAGS = 5

const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "de R$ 99,90 por R$ 79,90 (−20%)" só com preço anterior real e queda de pelo menos 5%; senão, só o preço. */
export function priceText(facts: PostFacts) {
  if (facts.originalPrice && facts.originalPrice > facts.price && (facts.discountPercent ?? 0) >= 5) {
    return `de ${money(facts.originalPrice)} por ${money(facts.price)} (−${Math.round(facts.discountPercent ?? 0)}%)`
  }
  return money(facts.price)
}

/** "Nota 4,8 · 1,2 mil vendas": só o que existe. */
export function proofText(facts: PostFacts) {
  const parts: string[] = []
  if (facts.rating > 0) parts.push(`Nota ${facts.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`)
  if (facts.soldCount >= 50) parts.push(`${salesLabel(facts.soldCount)} vendas`)
  return parts.join(' · ')
}

/** Hashtags por categoria do catálogo. Só termos neutros: nada que prometa promoção sem desconto real. */
const categoryTags: Record<string, string[]> = {
  tecnologia: ['tecnologia', 'gadgets', 'tech'],
  casa: ['casa', 'decoracao', 'organizacao'],
  audio: ['audio', 'fonedeouvido', 'som'],
  cozinha: ['cozinha', 'utilidades', 'casaecozinha'],
  'bem-estar': ['bemestar', 'saude', 'autocuidado'],
  pet: ['pet', 'petlovers', 'cachorro'],
  beleza: ['beleza', 'skincare', 'maquiagem'],
  fitness: ['fitness', 'treino', 'academia'],
  games: ['games', 'gamer', 'jogos'],
  eletronicos: ['eletronicos', 'tecnologia', 'gadgets'],
  eletrodomesticos: ['eletrodomesticos', 'casa', 'cozinha'],
}

/** Uma hashtag válida: só letras e números, sem acento, minúscula, até 30 caracteres. */
export function toTag(raw: string) {
  const clean = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 30)
  return clean ? `#${clean}` : ''
}

/** Lê "#garimpou #achadinhos, shopee" do painel e devolve hashtags limpas, sem repetir. */
export function parseBrandTags(input: string): string[] {
  return [...new Set(input.split(/[\s,;]+/).map(toTag).filter(Boolean))]
}

export type ContentOptions = {
  category: string
  /** Estável por produto: o mesmo produto cai sempre no mesmo modelo; produtos diferentes variam. */
  seed: string
  brandTags: string[]
  /** Identifica o conteúdo como publicidade (#publi e linha de afiliado). */
  disclosure: boolean
}

export function hashtagsFor(channel: ContentChannel, facts: PostFacts, options: ContentOptions): string[] {
  const limit = channel === 'instagram' ? INSTAGRAM_TAGS : TIKTOK_TAGS
  const tags = [
    ...(options.disclosure ? ['#publi'] : []),
    ...options.brandTags,
    ...(categoryTags[options.category] ?? []).map(toTag),
    ...((facts.discountPercent ?? 0) >= 5 && facts.originalPrice ? ['#oferta'] : []),
    '#shopee',
  ]
  return [...new Set(tags.filter(Boolean))].slice(0, limit)
}

const DISCLOSURE_LINE = 'Publi: contém link de afiliado da Shopee.'

const instagramHooks = [
  'Achado do dia 🔎',
  'Separei este aqui pra você 👇',
  'Olha o que eu encontrei na Shopee 👀',
  'Salva esse achado pra depois 📌',
  'Dica de compra de hoje 💡',
  'Esse entrou na minha lista 🛒',
]

const instagramClosers = [
  'Link na bio 🔗',
  'Toque no link da bio para ver na Shopee 🔗',
  'Link direto na bio 👆',
  'Quer ver? Link na bio 🔗',
]

export type InstagramContent = { caption: string; hashtags: string[] }

export function composeInstagram(facts: PostFacts, options: ContentOptions): InstagramContent {
  const title = cleanTitle(facts.name, 90)
  const hook = instagramHooks[pick(`${options.seed}:hook`, instagramHooks.length)]
  const closer = instagramClosers[pick(`${options.seed}:closer`, instagramClosers.length)]
  const proof = proofText(facts)
  const hashtags = hashtagsFor('instagram', facts, options)
  const layout = pick(options.seed, 3)
  const lines = layout === 0
    ? [hook, '', title, priceText(facts), ...(proof ? [proof] : []), '', closer]
    : layout === 1
      ? [`${hook}`, title, '', `💰 ${priceText(facts)}`, ...(proof ? [`⭐ ${proof}`] : []), '', closer]
      : [title, '', `${priceText(facts)}${proof ? ` · ${proof}` : ''}`, '', hook, closer]
  if (options.disclosure) lines.push('', DISCLOSURE_LINE)
  lines.push('', hashtags.join(' '))
  const caption = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { caption: caption.length > CONTENT_LIMIT ? caption.slice(0, CONTENT_LIMIT - 1).trimEnd() : caption, hashtags }
}

const tiktokHooks = [
  'Achado do dia na Shopee',
  'Separei esse aqui pra você',
  'Vem ver o que eu achei',
  'Salva esse vídeo pra não esquecer',
  'Olha só esse achado',
]

export type TikTokContent = { caption: string; script: string; hashtags: string[]; onScreen: string[] }

/** Frase curta para a tela: o nome sem a gritaria dos anúncios, em até ~40 caracteres. */
function shortTitle(name: string) {
  return cleanTitle(name, 42)
}

export function composeTikTok(facts: PostFacts, options: ContentOptions): TikTokContent {
  const hook = tiktokHooks[pick(`${options.seed}:tt`, tiktokHooks.length)]
  const title = cleanTitle(facts.name, 80)
  const short = shortTitle(facts.name)
  const price = priceText(facts)
  const proof = proofText(facts)
  const hashtags = hashtagsFor('tiktok', facts, options)
  const onScreen = [short, price, 'Link na bio']
  const script = [
    'Formato: vídeo vertical de 15 a 25 segundos.',
    '',
    `0–3 s · Abertura: diga “${hook}” com o produto na mão ou em uso.`,
    `3–10 s · Mostre o produto (${title}). Mostre de perto os detalhes que o próprio anúncio da Shopee mostra.`,
    `10–18 s · Fale o preço: “${price}”.${proof ? ` Cite só o que é dado: ${proof}.` : ''}`,
    '18–22 s · Fechamento: aponte para o link e diga “link na bio”.',
    '',
    `Texto na tela: “${onScreen[0]}” → “${onScreen[1]}” → “${onScreen[2]}”.`,
    'Não prometa o que o anúncio não diz (desconto, frete, prazo, estoque).',
  ].join('\n')
  const lead = `${short} por ${price} 👀 Link na bio`
  const caption = [lead, ...(options.disclosure ? ['', DISCLOSURE_LINE] : []), '', hashtags.join(' ')].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { caption, script, hashtags, onScreen }
}

/** Texto completo para colar: legenda e, no TikTok, o roteiro vai separado (fica em `facts.script`). */
export function composeContent(channel: ContentChannel, facts: PostFacts, options: ContentOptions) {
  if (channel === 'instagram') {
    const content = composeInstagram(facts, options)
    return { text: content.caption, script: null as string | null, hashtags: content.hashtags }
  }
  const content = composeTikTok(facts, options)
  return { text: content.caption, script: content.script, hashtags: content.hashtags }
}
