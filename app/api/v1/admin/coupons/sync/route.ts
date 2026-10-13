import { recordAudit } from '@/lib/admin/audit'
import { ShopeeApiError } from '@/lib/providers/shopee/client'
import { syncShopeeCampaigns } from '@/lib/providers/shopee/campaigns'
import { authorize, fail, ok } from '@/lib/server/api'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** Importa as campanhas oficiais da Shopee para a área de cupons (entram ocultas até a equipe liberar). */
export async function POST(request: Request) {
  const { blocked, userId } = await authorize(request, 'content:write')
  if (blocked) return blocked
  try {
    const result = await syncShopeeCampaigns()
    await recordAudit({ actorUserId: userId, action: 'cupons.sync', entityType: 'cupom', entityId: 'shopee', after: result })
    return ok(result)
  } catch (error) {
    if (error instanceof ShopeeApiError) {
      console.error(`[cupons] erro da API da Shopee${error.code ? ` (código ${error.code})` : ''}: ${error.message}`)
      return fail('A API da Shopee recusou ou falhou ao buscar as campanhas.', 502)
    }
    console.error('[cupons] falha na sincronização', error)
    return fail('Falha ao sincronizar as campanhas.', 500)
  }
}
