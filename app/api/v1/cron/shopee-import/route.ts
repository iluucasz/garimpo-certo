import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { runCatalogImport } from '@/lib/providers/shopee/run'
import { fail, ok } from '@/lib/server/api'

// A importação faz várias chamadas sequenciais à API da Shopee; o padrão da plataforma é curto demais.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return 'missing' as const
  const received = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) ? ('ok' as const) : ('denied' as const)
}

/**
 * Atualiza o catálogo com a API de afiliados da Shopee. Chamado pelo Vercel Cron (vercel.json),
 * que envia `Authorization: Bearer $CRON_SECRET`. Sem CRON_SECRET configurado, a rota fica desligada.
 */
export async function GET(request: Request) {
  const auth = authorized(request)
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
