import { revalidateTag } from 'next/cache'
import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { runCatalogImport } from '@/lib/providers/shopee/run'
import { fail, ok } from '@/lib/server/api'
import { cronAuthorization } from '@/lib/server/cron-auth'

// A importação faz várias chamadas sequenciais à API da Shopee; o padrão da plataforma é curto demais.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Atualiza o catálogo com a API de afiliados da Shopee. Pode ser chamado por qualquer agendador
 * (hoje o worker da VPS, em worker/importer.ts) com `Authorization: Bearer $CRON_SECRET`. Sem CRON_SECRET configurado, a rota fica desligada.
 */
export async function GET(request: Request) {
  const auth = cronAuthorization(request)
  if (auth === 'missing') return fail('CRON_SECRET não configurado: importação agendada desativada.', 503)
  if (auth === 'denied') return fail('Não autorizado.', 401)

  try {
    const result = await runCatalogImport()
    // Faz a vitrine e as páginas de produto refletirem a importação já na próxima visita.
    revalidateTag('catalog', 'max')
    revalidateTag('metrics', 'max')
    return ok(result)
  } catch (error) {
    if (error instanceof ShopeeApiError) {
      console.error(`[cron] erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
      return fail('A API da Shopee recusou ou falhou na importação.', 502)
    }
    console.error('[cron] falha na importação', error)
    return fail('Falha ao importar o catálogo.', 500)
  }
}
