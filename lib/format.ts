/** Formatadores de exibição em pt-BR. */
export const formatPrice = (value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value)
// A API de afiliados devolve um número de vendas menor que o total exibido no anúncio da Shopee
// (o anúncio mostra o acumulado). Como a Shopee não documenta o período desse campo, a etiqueta
// fala em vendas recentes, que é verdade nos dois casos.
export const formatSoldCount = (value:number)=>`${new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(value)} ${value===1?'venda recente':'vendas recentes'}`
