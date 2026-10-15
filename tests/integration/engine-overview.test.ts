import { describe, expect, it } from 'vitest'
import { getEngineOverview, nextDailyAt } from '@/lib/engine/overview'
import { activeCategoryBonuses, loadCategoryStats, loadImportSettings } from '@/lib/engine/store'
import { workerState } from '@/lib/engine/heartbeat'

describe('central da Engine', () => {
  it('monta a visão geral com tudo o que ela faz', async () => {
    const overview = await getEngineOverview()
    expect(overview.tasks.map((task) => task.id)).toEqual(['import', 'commissions', 'engine', 'learn', 'social'])
    expect(['off', 'shadow', 'approval', 'auto']).toContain(overview.master.engine)
    expect(overview.catalog.products).toBeGreaterThan(0)
    expect(Array.isArray(overview.approvals.proposals)).toBe(true)
    expect(Array.isArray(overview.activity)).toBe(true)
    for (const task of overview.tasks) {
      expect(task.title.length).toBeGreaterThan(0)
      expect(['ok', 'attention', 'idle', 'off']).toContain(task.state)
    }
  })

  it('lê as configurações da importação com limites seguros', async () => {
    const settings = await loadImportSettings()
    expect(settings.perCategory).toBeGreaterThanOrEqual(10)
    expect(settings.perCategory).toBeLessThanOrEqual(80)
    expect(settings.minRating).toBeGreaterThanOrEqual(4)
    expect(typeof settings.enabled).toBe('boolean')
  })

  it('conta cliques por categoria sem inventar categorias', async () => {
    const stats = await loadCategoryStats(30)
    expect(stats.length).toBeGreaterThan(0)
    for (const item of stats) {
      expect(item.products).toBeGreaterThan(0)
      expect(item.clicks).toBeGreaterThanOrEqual(0)
    }
    const bonuses = await activeCategoryBonuses()
    for (const value of Object.values(bonuses)) expect(value).toBeLessThanOrEqual(40)
  })

  it('calcula o próximo horário diário em Brasília', () => {
    const now = Date.UTC(2026, 9, 14, 10, 0, 0) // 07:00 em Brasília
    expect(nextDailyAt('06:00', now)).toBe('2026-10-15T09:00:00.000Z')
    expect(nextDailyAt('09:30', now)).toBe('2026-10-14T12:30:00.000Z')
  })

  it('classifica o sinal de vida do worker', () => {
    const now = Date.now()
    expect(workerState(null, now)).toBe('unknown')
    expect(workerState({ at: new Date(now - 2 * 60_000).toISOString(), startedAt: '', importAt: null }, now)).toBe('online')
    expect(workerState({ at: new Date(now - 15 * 60_000).toISOString(), startedAt: '', importAt: null }, now)).toBe('stale')
    expect(workerState({ at: new Date(now - 3 * 3_600_000).toISOString(), startedAt: '', importAt: null }, now)).toBe('offline')
  })
})
