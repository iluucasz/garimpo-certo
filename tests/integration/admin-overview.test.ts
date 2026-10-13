import { describe, expect, it } from 'vitest'
import { getAdminOverview, listCatalogForAdmin } from '@/lib/db/repositories/admin-overview'

describe('números do painel administrativo', () => {
  it('vêm do banco, com 7 dias contínuos de cliques', async () => {
    const overview = await getAdminOverview()
    expect(overview.catalog.active).toBeGreaterThan(0)
    expect(overview.catalog.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(overview.clicks.byDay).toHaveLength(7)
    const days = overview.clicks.byDay.map((entry) => entry.day)
    expect(new Set(days).size).toBe(7)
    expect([...days].sort()).toEqual(days)
    expect(overview.clicks.total).toBeGreaterThanOrEqual(overview.clicks.last7d)
    expect(overview.topProducts.length).toBeGreaterThan(0)
    expect(overview.topProducts[0].soldCount).toBeGreaterThanOrEqual(overview.topProducts.at(-1)!.soldCount)
  })

  it('lista o catálogo com status e melhor oferta', async () => {
    const list = await listCatalogForAdmin()
    const active = list.filter((item) => item.active)
    expect(active.length).toBeGreaterThanOrEqual(1)
    // Um produto com várias ofertas não pode aparecer duas vezes na lista.
    expect(new Set(active.map((item) => item.id)).size).toBe(active.length)
    for (const item of active) expect(item.price).not.toBeNull()
  })
})
