import { unstable_cache } from 'next/cache'

/**
 * Leitura do banco com cache de dados do Next (5 min) e invalidação por tag. Fora do runtime do Next
 * (testes, scripts) o cache não existe e a leitura vai direto ao banco.
 */
export function cachedQuery<T>(load: () => Promise<T>, keyParts: string[], tags: string[], revalidate = 86400) {
  const wrapped = unstable_cache(load, keyParts, { revalidate, tags })
  return async (): Promise<T> => {
    try {
      return await wrapped()
    } catch (error) {
      if (error instanceof Error && /incrementalCache|static generation store/i.test(error.message)) return load()
      throw error
    }
  }
}
