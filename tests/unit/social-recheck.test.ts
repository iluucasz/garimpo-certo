import { describe, expect, it } from 'vitest'
import { recheckOffer, type OfferNow } from '@/lib/social/recheck'
import type { PostFacts } from '@/lib/social/compose'

const facts: PostFacts = { name: 'Fone', price: 100, originalPrice: 150, discountPercent: 33, rating: 4.8, soldCount: 900 }
const now = (patch: Partial<NonNullable<OfferNow>> = {}): OfferNow => ({
  offerStatus: 'active', productStatus: 'active', price: 100, originalPrice: 150, discountPercent: 33, rating: 4.8, soldCount: 950, ...patch,
})

describe('conferência antes do envio', () => {
  it('nada mudou no preço: envia (nota e vendas novas não obrigam a refazer o texto)', () => {
    expect(recheckOffer(facts, now())).toEqual({ action: 'send' })
  })
  it('preço caiu: atualiza o texto com os números de agora', () => {
    const result = recheckOffer(facts, now({ price: 89.9, discountPercent: 40, soldCount: 1000 }))
    expect(result).toMatchObject({ action: 'refresh', facts: { price: 89.9, discountPercent: 40, soldCount: 1000, name: 'Fone' } })
  })
  it('subiu pouco: atualiza; subiu mais de 10%: cancela', () => {
    expect(recheckOffer(facts, now({ price: 105 })).action).toBe('refresh')
    const cancelled = recheckOffer(facts, now({ price: 120 }))
    expect(cancelled).toMatchObject({ action: 'cancel' })
    expect((cancelled as { reason: string }).reason).toMatch(/subiu/)
  })
  it('o "de" sumiu ou apareceu: refaz, para não manter um desconto que não existe mais', () => {
    expect(recheckOffer(facts, now({ originalPrice: null, discountPercent: null })).action).toBe('refresh')
  })
  it('oferta ou produto fora do ar, ou sem preço: cancela', () => {
    expect(recheckOffer(facts, null).action).toBe('cancel')
    expect(recheckOffer(facts, now({ offerStatus: 'removed' })).action).toBe('cancel')
    expect(recheckOffer(facts, now({ productStatus: 'removed' })).action).toBe('cancel')
    expect(recheckOffer(facts, now({ price: 0 })).action).toBe('cancel')
  })
})
