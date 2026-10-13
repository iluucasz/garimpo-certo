/**
 * Conferência da oferta imediatamente antes do envio. Função pura (sem banco, sem imports do Next).
 *
 * O texto da postagem afirma preço, desconto, nota e vendas de quando foi criado. Entre criar e enviar a
 * oferta pode ter mudado; mandar o número antigo seria afirmar algo que já não é verdade. Então:
 *  - oferta que saiu do ar ou produto arquivado: a postagem é cancelada;
 *  - preço subiu muito: cancelada (o motivo para postar acabou);
 *  - qualquer outra mudança: o texto é refeito com os números de agora, no modelo fixo;
 *  - nada mudou: envia como está.
 */
import type { PostFacts } from './compose'

export type OfferNow = {
  offerStatus: string
  productStatus: string
  price: number
  originalPrice: number | null
  discountPercent: number | null
  rating: number
  soldCount: number
} | null

export type Recheck =
  | { action: 'send' }
  | { action: 'refresh'; facts: PostFacts; reason: string }
  | { action: 'cancel'; reason: string }

/** Acima disso, a alta de preço derruba o motivo da postagem: cancela em vez de atualizar. */
export const MAX_PRICE_RISE = 0.1

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
const same = (a: number, b: number) => Math.abs(a - b) < 0.005

export function recheckOffer(facts: PostFacts, now: OfferNow): Recheck {
  if (!now || now.offerStatus !== 'active' || now.productStatus !== 'active') {
    return { action: 'cancel', reason: 'A oferta saiu do ar desde que a postagem foi criada; não foi enviada.' }
  }
  if (!Number.isFinite(now.price) || now.price <= 0) {
    return { action: 'cancel', reason: 'A oferta está sem preço válido agora; não foi enviada.' }
  }
  if (facts.price > 0 && now.price > facts.price * (1 + MAX_PRICE_RISE)) {
    return { action: 'cancel', reason: `O preço subiu de ${money(facts.price)} para ${money(now.price)} desde que a postagem foi criada; não foi enviada.` }
  }
  const unchanged = same(now.price, facts.price)
    && (now.originalPrice === null) === (facts.originalPrice === null)
    && (now.originalPrice === null || facts.originalPrice === null || same(now.originalPrice, facts.originalPrice))
  if (unchanged) return { action: 'send' }
  return {
    action: 'refresh',
    reason: `Preço conferido antes do envio: era ${money(facts.price)}, agora ${money(now.price)}.`,
    facts: {
      ...facts,
      price: now.price,
      originalPrice: now.originalPrice,
      discountPercent: now.discountPercent,
      rating: now.rating || facts.rating,
      soldCount: now.soldCount || facts.soldCount,
    },
  }
}
