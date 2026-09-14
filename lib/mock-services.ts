import type { Offer, Product } from './types'

export function searchProducts(list: Product[], query: string, category?: string): Product[] {
 const term=query.trim().toLocaleLowerCase('pt-BR')
 return list.filter(product=>(!category||category==='todos'||product.category===category)&&(!term||[product.name,product.brand,product.description,...product.tags].join(' ').toLocaleLowerCase('pt-BR').includes(term)))
}
export function rankProducts(list:Product[],sort:string,offers:Offer[]){
 return [...list].sort((a,b)=>sort==='menor-preco'?bestPrice(offers,a.id)-bestPrice(offers,b.id):sort==='avaliacao'?b.rating-a.rating:sort==='crescimento'?b.growth-a.growth:b.score-a.score)
}
export function bestPrice(offers:Offer[],id:string){const prices=offers.filter(o=>o.productId===id).map(o=>o.price+o.shipping);return prices.length?Math.min(...prices):0}
export const featureFlags={personalizedHome:true,priceHistory:true,comparison:true,editorial:true}
