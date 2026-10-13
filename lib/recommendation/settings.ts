import type { ScoringWeights } from './engine'
import { rankingFactors } from '@/lib/admin/settings-defs'

/** Converte os valores salvos no painel (0–100) nos pesos do motor e na taxa de exploração (0–1). */
export function rankingFromSettings(settings: Record<string, unknown>): { weights: ScoringWeights; explorationRate: number } {
  const weights = Object.fromEntries(rankingFactors.map(([key]) => [key, Math.max(0, Number(settings[key] ?? 0)) / 100])) as ScoringWeights
  const exploration = Number(settings.exploration)
  return { weights, explorationRate: Number.isFinite(exploration) ? Math.min(0.4, Math.max(0, exploration / 100)) : 0.12 }
}
