import type { StoreCatalog } from '@/lib/db/repositories/store-catalog'

/**
 * O layout serializa o catálogo no HTML de TODA página. Para o contexto do cliente mandamos só o que
 * listas, busca, comparador e o motor de recomendação leem: a página de produto recebe o item completo
 * (galeria, descrição longa e histórico de preço) direto do servidor.
 * O histórico mantém o primeiro e o último ponto, que é o que o motor usa para medir queda de preço.
 */
export function toClientCatalog(catalog: StoreCatalog): StoreCatalog {
  return {
    ...catalog,
    products: catalog.products.map((product) => ({
      ...product,
      longDescription: '',
      images: [],
      priceHistory: product.priceHistory.length > 2 ? [product.priceHistory[0], product.priceHistory[product.priceHistory.length - 1]] : product.priceHistory,
    })),
  }
}
