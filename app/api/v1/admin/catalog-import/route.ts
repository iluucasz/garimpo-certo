import { revalidateTag } from 'next/cache'
import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { runCatalogImport } from '@/lib/providers/shopee/run'
import { authorize, fail, ok } from '@/lib/server/api'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** Importação sob demanda pelo painel. Mesmo código do cron; exige a permissão `jobs:run`. */
export async function POST(request: Request) {
  const { blocked } = await authorize(request, 'jobs:run')
  if (blocked) return blocked
  try {
    const result = await runCatalogImport({ refreshBudget: 40 })
    revalidateTag('catalog', 'max')
    revalidateTag('metrics', 'max')
    return ok(result)
  } catch (error) {
    if (error instanceof ShopeeApiError) {
      console.error(`[admin-import] erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
      return fail('A API da Shopee recusou ou falhou na importação.', 502)
    }
    console.error('[admin-import] falha na importação', error)
    return fail('Falha ao importar o catálogo.', 500)
  }
}
