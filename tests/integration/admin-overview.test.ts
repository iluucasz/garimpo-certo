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
    const [overview, list] = await Promise.all([getAdminOverview(), listCatalogForAdmin()])
    expect(list.filter((item) => item.active).length).toBeGreaterThanOrEqual(1)
    expect(new Set(list.filter((item) => item.active).map((item) => item.id)).size).toBe(overview.catalog.active)
    for (const item of list.filter((entry) => entry.active)) expect(item.price).not.toBeNull()
  })
})
