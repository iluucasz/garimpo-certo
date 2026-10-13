/**
 * Coleções de curadoria manual.
 *
 * Algumas ideias não saem de nenhum número da Shopee (por exemplo, "o que viralizou no TikTok"):
 * quem sabe é a equipe. Para criar uma, liste os IDs dos itens da Shopee (o número no fim do link do
 * produto, que também é o final do `slug` na página do produto). A coleção só aparece quando pelo menos
 * 3 desses produtos estiverem ativos no catálogo.
 *
 * Exemplo de ID: o produto `.../produto/fone-bluetooth-...-22494456015` tem ID `22494456015`.
 */
export type CuratedCollection = {
  slug: string
  title: string
  tone: string
  description: string
  /** IDs de item da Shopee (final do slug do produto). */
  itemIds: string[]
}

export const curatedCollections: CuratedCollection[] = [
  {
    slug: 'virais-do-tiktok',
    title: 'Virais do TikTok',
    tone: 'Selecionados pela nossa equipe',
    description: 'Produtos que a nossa equipe viu bombar no TikTok e que estão disponíveis na Shopee.',
    // Preencha com os IDs dos produtos. Vazia, a coleção não aparece.
    itemIds: [],
  },
]
