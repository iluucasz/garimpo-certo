/**
 * Escolha das ofertas para divulgar. Funções puras: recebem candidatos (já lidos do banco) e devolvem a ordem.
 * A nota de divulgação é interna e mistura qualidade, desconto real e comissão; ela **nunca** aparece para o
 * visitante e a comissão só pesa como desempate suave (regra do Índice Garimpo, ver docs/ENGINE.md).
 */

export type PostCandidate = {
  productId: string
  offerId: string
  name: string
  slug: string
  imageUrl: string | null
  category: string
  price: number
  originalPrice: number | null
  discountPercent: number | null
  rating: number
  soldCount: number
  editorialScore: number
  commissionRate: number
  /** Queda do preço atual frente ao maior preço dos últimos 30 dias, em %, a partir do histórico real. */
  priceDropPercent: number
  externalUrl: string
  /** Última vez que o produto foi divulgado no canal, ou null. */
  lastPostedAt: string | null
}

export type PickOptions = {
  now: number
  /** Dias sem repetir o mesmo produto no canal. */
  cooldownDays: number
  minRating: number
  minSold: number
  minPrice: number
  /** Quantas ofertas devolver. */
  limit: number
  /** Máximo por categoria no mesmo lote, para a vitrine do canal não ficar monotemática. */
  perCategory: number
}

export const defaultPickOptions: Omit<PickOptions, 'now' | 'limit'> = { cooldownDays: 14, minRating: 4.5, minSold: 100, minPrice: 10, perCategory: 1 }

export type Ranked = { candidate: PostCandidate; score: number; reasons: string[] }

const dayMs = 86_400_000

export function scoreCandidate(candidate: PostCandidate): { score: number; reasons: string[] } {
  const reasons: string[] = []
  const discount = Math.min(candidate.discountPercent ?? 0, 60)
  const drop = Math.min(candidate.priceDropPercent, 40)
  const sales = Math.min(Math.log10(Math.max(candidate.soldCount, 0) + 1) / 5, 1)
  const commission = Math.min(candidate.commissionRate / 0.2, 1)
  const score = (candidate.editorialScore / 100) * 0.4 + (discount / 60) * 0.2 + (drop / 40) * 0.15 + sales * 0.15 + commission * 0.1
  if (candidate.editorialScore >= 80) reasons.push(`Índice Garimpo ${Math.round(candidate.editorialScore)}`)
  if ((candidate.discountPercent ?? 0) >= 10) reasons.push(`${Math.round(candidate.discountPercent!)}% abaixo do preço anterior`)
  if (candidate.priceDropPercent >= 5) reasons.push(`preço ${Math.round(candidate.priceDropPercent)}% menor que o maior dos últimos 30 dias`)
  if (candidate.soldCount >= 1000) reasons.push(`${candidate.soldCount.toLocaleString('pt-BR')} vendas`)
  return { score, reasons }
}

export function eligible(candidate: PostCandidate, options: PickOptions) {
  if (candidate.rating < options.minRating || candidate.soldCount < options.minSold || candidate.price < options.minPrice) return false
  if (!candidate.imageUrl) return false
  if (candidate.lastPostedAt && options.now - new Date(candidate.lastPostedAt).getTime() < options.cooldownDays * dayMs) return false
  return true
}

/** Melhores candidatos, com no máximo `perCategory` por categoria no lote. */
export function rankCandidates(candidates: PostCandidate[], options: PickOptions): Ranked[] {
  const ranked = candidates.filter((candidate) => eligible(candidate, options))
    .map((candidate) => ({ candidate, ...scoreCandidate(candidate) }))
    .sort((a, b) => b.score - a.score || b.candidate.soldCount - a.candidate.soldCount)
  const perCategory = new Map<string, number>()
  const chosen: Ranked[] = []
  for (const item of ranked) {
    const used = perCategory.get(item.candidate.category) ?? 0
    if (used >= options.perCategory) continue
    perCategory.set(item.candidate.category, used + 1)
    chosen.push(item)
    if (chosen.length >= options.limit) break
  }
  return chosen
}
