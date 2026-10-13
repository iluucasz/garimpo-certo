import { revalidateTag } from 'next/cache'
import { recordAudit } from '@/lib/admin/audit'
import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { runConversionSync } from '@/lib/providers/shopee/conversions-run'
import { authorize, fail, ok } from '@/lib/server/api'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Traz as comissões reais da Shopee agora. Mesmo código do worker da VPS; exige `jobs:run`. */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'jobs:run')
  if (blocked) return blocked
  try {
    const result = await runConversionSync()
    revalidateTag('metrics', 'max')
    await recordAudit({ actorUserId: userId, action: 'comissoes.sync', entityType: 'conversao', entityId: 'shopee', after: result })
    return ok(result)
  } catch (error) {
    if (error instanceof ShopeeApiError) {
      console.error(`[comissoes] erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
      return fail('A API da Shopee recusou ou falhou ao buscar as comissões.', 502)
    }
    console.error('[comissoes] falha na sincronização', error)
    return fail('Falha ao sincronizar as comissões.', 500)
  }
}
