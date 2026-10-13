import { revalidateTag } from 'next/cache'

/**
 * Invalida tags de cache de dados depois de uma alteração pelo painel. Usa `{ expire: 0 }`: quem editou espera
 * ver o resultado na próxima visita, então não se serve conteúdo antigo enquanto revalida (como faz o perfil `max`). Fora do runtime do Next (testes,
 * scripts) não há cache a invalidar e `revalidateTag` lança; isso é ignorado de propósito.
 */
export function invalidate(...tags: string[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch (error) {
      if (!(error instanceof Error && /static generation store|incrementalCache/i.test(error.message))) throw error
    }
  }
}
