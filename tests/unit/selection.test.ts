import { describe, expect, it } from 'vitest'
import type { ShopeeProductOffer } from '@/lib/providers/shopee/client'
import { defaultMix, highTicketMix, nameKey, selectForCategory, tierOf, tierRank, type Candidate, type SelectionOptions } from '@/lib/providers/shopee/selection'

let counter = 0
/** `price` aqui é número (na API é texto); os demais campos seguem o tipo da oferta. */
type Patch = Partial<Omit<ShopeeProductOffer, 'price'>> & { price?: number }
const offer = (patch: Patch = {}): ShopeeProductOffer => {
  counter += 1
  const { price: given, ...rest } = patch
  const price = given ?? 20
  return {
    itemId: counter, productName: `Produto numero ${counter} diferente`, priceMin: String(price), priceMax: String(price), price: String(price),
    sales: 500, ratingStar: '4.8', imageUrl: 'https://cf.shopee.com.br/x.jpg', offerLink: 'https://s.shopee.com.br/x', productLink: 'https://shopee.com.br/x',
    commissionRate: '0.05', commission: String(Math.round(price * 0.05 * 100) / 100), priceDiscountRate: 0, shopName: `Loja ${counter}`, shopId: counter, productCatIds: [],
    ...rest,
  }
}
const candidate = (patch: Patch = {}, source = 'kw:teste'): Candidate => ({ offer: offer(patch), source })

const options = (patch: Partial<SelectionOptions> = {}): SelectionOptions => ({
  perCategory: 10, mix: defaultMix, minRating: 4.5, minSales: { essencial: 50, intermediario: 30, premium: 15 }, maxPerShop: 2, ...patch,
})
const fresh = () => ({ seen: new Set<string>(), perShop: new Map<number, number>() })

describe('seleção do catálogo por faixa de preço', () => {
  it('classifica o preço nas três faixas', () => {
    expect(tierOf(5)).toBe('essencial')
    expect(tierOf(99.9)).toBe('essencial')
    expect(tierOf(100)).toBe('intermediario')
    expect(tierOf(499.9)).toBe('intermediario')
    expect(tierOf(500)).toBe('premium')
    expect(tierOf(4499)).toBe('premium')
  })

  it('não deixa produtos baratos tomarem a categoria inteira', () => {
    const cheap = Array.from({ length: 40 }, (_, index) => candidate({ price: 10 + index, sales: 10_000 - index }))
    const mid = Array.from({ length: 6 }, (_, index) => candidate({ price: 150 + index * 20, sales: 200 }))
    const premium = Array.from({ length: 6 }, (_, index) => candidate({ price: 1000 + index * 100, sales: 60 }))
    const result = selectForCategory([...cheap, ...mid, ...premium], options(), fresh())
    expect(result.offers).toHaveLength(10)
    // mix padrão com 10 vagas: 4 / 4 (3,5 arredondado) / 2 (2,5): todas as faixas aparecem
    expect(result.byTier.premium).toBeGreaterThanOrEqual(2)
    expect(result.byTier.intermediario).toBeGreaterThanOrEqual(3)
    expect(result.byTier.essencial).toBeGreaterThanOrEqual(3)
  })

  it('categoria de produto caro reserva a maior parte para as faixas altas', () => {
    const cheap = Array.from({ length: 30 }, (_, index) => candidate({ price: 8 + index, sales: 9000 - index }))
    const premium = Array.from({ length: 12 }, (_, index) => candidate({ price: 2000 + index * 100, sales: 100 }))
    const result = selectForCategory([...cheap, ...premium], options({ mix: highTicketMix }), fresh())
    expect(result.byTier.premium).toBe(5)
  })

  it('o PS5 entra mesmo vendendo muito menos que um acessório de R$ 5', () => {
    const accessory = candidate({ productName: 'Par de grip para controle PS5', price: 5, sales: 1569, commission: '0' })
    const console = candidate({ productName: 'Console PlayStation 5 Slim Digital 825GB', price: 4499, sales: 715, commissionRate: '0.06', commission: '270' })
    const result = selectForCategory([accessory, console], options({ perCategory: 2, mix: highTicketMix }), fresh())
    expect(result.offers.map((item) => item.productName)).toContain('Console PlayStation 5 Slim Digital 825GB')
  })

  it('nas faixas de valor ordena por vendas x comissão; na básica, por vendas', () => {
    const popularCheap = offer({ price: 20, sales: 9000, commission: '1' })
    const lessSold = offer({ price: 20, sales: 100, commission: '1' })
    expect(tierRank(popularCheap, 'essencial')).toBeGreaterThan(tierRank(lessSold, 'essencial'))
    const tv = offer({ price: 2000, sales: 500, commission: '86' })
    const notebook = offer({ price: 3500, sales: 15, commission: '250' })
    expect(tierRank(tv, 'premium')).toBeGreaterThan(tierRank(notebook, 'premium'))
  })

  it('mantém o corte de qualidade (nota e vendas mínimas por faixa)', () => {
    const lowRating = candidate({ price: 800, sales: 500, ratingStar: '4.1' })
    const lowSalesPremium = candidate({ price: 800, sales: 5 })
    const okPremium = candidate({ price: 800, sales: 20 })
    const lowSalesCheap = candidate({ price: 20, sales: 30 })
    const result = selectForCategory([lowRating, lowSalesPremium, okPremium, lowSalesCheap], options(), fresh())
    expect(result.offers).toHaveLength(1)
    expect(result.offers[0].itemId).toBe(okPremium.offer.itemId)
  })

  it('não repete o mesmo produto anunciado por várias lojas na mesma categoria', () => {
    const name = 'Console PlayStation 5 Slim Digital 825GB'
    const result = selectForCategory([
      candidate({ productName: name, price: 4499, sales: 715 }),
      candidate({ productName: name + ' ', price: 4500, sales: 84 }),
      candidate({ productName: 'Outro console completamente diferente', price: 3000, sales: 90 }),
    ], options({ perCategory: 5 }), fresh())
    expect(result.offers).toHaveLength(2)
    expect(nameKey(name)).toBe(nameKey(name + ' '))
  })

  it('respeita o limite de produtos por loja entre categorias', () => {
    const state = fresh()
    const sameShop = Array.from({ length: 5 }, () => candidate({ shopId: 7, price: 30 + counter % 5 }))
    const first = selectForCategory(sameShop, options(), state)
    expect(first.offers).toHaveLength(2)
    const second = selectForCategory(Array.from({ length: 3 }, () => candidate({ shopId: 7, price: 40 })), options(), state)
    expect(second.offers).toHaveLength(0)
  })

  it('não escolhe duas vezes o mesmo item em categorias diferentes', () => {
    const state = fresh()
    const shared = candidate({ price: 300, sales: 400 })
    expect(selectForCategory([shared], options(), state).offers).toHaveLength(1)
    expect(selectForCategory([shared], options(), state).offers).toHaveLength(0)
  })

  it('completa as vagas com o que mais vende quando uma faixa tem poucos itens bons', () => {
    const cheap = Array.from({ length: 12 }, (_, index) => candidate({ price: 10 + index, sales: 5000 - index }))
    const result = selectForCategory(cheap, options({ perCategory: 8 }), fresh())
    expect(result.offers).toHaveLength(8)
    expect(result.byTier.essencial).toBe(8)
  })

  it('ao acumular, não repete o produto que a categoria já tem (mesmo nome, outra loja)', () => {
    const repeated = candidate({ productName: 'Garrafa Termica Inox 500ml', price: 40 })
    const other = candidate({ productName: 'Copo Termico Com Canudo 1 litro', price: 45 })
    const result = selectForCategory([repeated, other], options({ knownKeys: new Set([nameKey('Garrafa Termica Inox 500ml')]) }), fresh())
    expect(result.offers.map((item) => item.itemId)).toEqual([other.offer.itemId])
  })

  it('ao acumular, conta as lojas que já estão no catálogo no limite por loja', () => {
    const batch = Array.from({ length: 4 }, () => candidate({ shopName: 'Loja Grande', shopId: 99, price: 30 }))
    const result = selectForCategory(batch, options({ maxPerShop: 3, shopBaseline: new Map([['Loja Grande', 2]]) }), fresh())
    expect(result.offers).toHaveLength(1)
  })

  it('ignora ofertas sem imagem, sem link ou sem preço', () => {
    const result = selectForCategory([candidate({ imageUrl: '' }), candidate({ offerLink: '' }), candidate({ price: 0, priceMin: '0', priceMax: '0' }), candidate()], options(), fresh())
    expect(result.offers).toHaveLength(1)
  })
})
