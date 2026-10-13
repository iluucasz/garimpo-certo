/**
 * Núcleo dos testes A/B do texto do topo da home. Funções puras e isomórficas: o navegador sorteia a variante com
 * `assignVariant`, o servidor valida os textos com `normalizeVariantB` e o painel lê o resultado com `compare`.
 *
 * Privacidade: só há sorteio e medição com a medição de uso permitida (`analytics`). Sem ela a pessoa sempre vê a
 * variante A (a home de hoje) e nada é guardado.
 */

export type Variant = 'a' | 'b'
export type VariantCopy = { title?: string; accent?: string; text?: string; buttonLabel?: string }

export const MIN_PER_VARIANT = 200

/** FNV-1a de 32 bits: estável, rápido e bem distribuído para sortear por visitante. */
export function hash32(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** 0–99. O mesmo visitante cai sempre no mesmo número para o mesmo teste. */
export const bucketOf = (visitorId: string, key: string) => hash32(`${key}:${visitorId}`) % 100

export const assignVariant = (visitorId: string, key: string, splitB: number): Variant => (bucketOf(visitorId, key) < splitB ? 'b' : 'a')

/** Vai no `sub_id` do clique: `<teste>-<variante>`, ex.: `topo-abril-b`. O slug do teste só tem letras, números e hífen. */
export const experimentTag = (key: string, variant: Variant) => `${key}-${variant}`

export const slugifyKey = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

const limits = { title: 40, accent: 40, text: 200, buttonLabel: 24 } as const

/** Valida os textos da variante B. Pelo menos um campo precisa ser diferente de vazio. */
export function normalizeVariantB(input: unknown): { value: VariantCopy } | { errors: Record<string, string> } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const value: VariantCopy = {}
  const errors: Record<string, string> = {}
  for (const [field, max] of Object.entries(limits) as [keyof typeof limits, number][]) {
    const raw = source[field]
    const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : ''
    if (text.length > max) errors[field] = `No máximo ${max} caracteres.`
    else if (text) value[field] = text
  }
  if (!Object.keys(errors).length && !Object.keys(value).length) errors.title = 'Escreva pelo menos um texto diferente para a variante B.'
  return Object.keys(errors).length ? { errors } : { value }
}

// ---------------------------------------------------------------- estatística

export type VariantStats = { exposed: number; converted: number }

export type Comparison = {
  rateA: number
  rateB: number
  /** Diferença absoluta em pontos percentuais (B − A). */
  diffPoints: number
  /** Intervalo de 95% da diferença, em pontos percentuais. */
  ciLow: number
  ciHigh: number
  /** Valor-p bilateral do teste z de duas proporções. */
  pValue: number
  verdict: 'insufficient' | 'b_better' | 'a_better' | 'no_difference'
  /** Quantas exposições faltam em cada variante para chegar ao mínimo. */
  missing: { a: number; b: number }
}

/** Distribuição normal acumulada (aproximação de Abramowitz e Stegun, erro < 1e-7). */
export function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

const rate = (stats: VariantStats) => (stats.exposed > 0 ? stats.converted / stats.exposed : 0)

/**
 * Compara as variantes. Só dá veredito com pelo menos `MIN_PER_VARIANT` exposições em cada uma: antes disso a
 * diferença é ruído e olhar o placar todo dia leva a "vencedores" que não existem.
 */
export function compare(a: VariantStats, b: VariantStats, alpha = 0.05): Comparison {
  const rateA = rate(a)
  const rateB = rate(b)
  const missing = { a: Math.max(0, MIN_PER_VARIANT - a.exposed), b: Math.max(0, MIN_PER_VARIANT - b.exposed) }
  const diff = rateB - rateA
  const pooled = a.exposed + b.exposed > 0 ? (a.converted + b.converted) / (a.exposed + b.exposed) : 0
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / Math.max(a.exposed, 1) + 1 / Math.max(b.exposed, 1)))
  const z = se > 0 ? diff / se : 0
  const pValue = se > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1
  const seDiff = Math.sqrt((rateA * (1 - rateA)) / Math.max(a.exposed, 1) + (rateB * (1 - rateB)) / Math.max(b.exposed, 1))
  const zCrit = 1.96
  const result: Comparison = {
    rateA, rateB, diffPoints: diff * 100, ciLow: (diff - zCrit * seDiff) * 100, ciHigh: (diff + zCrit * seDiff) * 100, pValue, missing, verdict: 'no_difference',
  }
  if (missing.a > 0 || missing.b > 0) result.verdict = 'insufficient'
  else if (pValue < alpha) result.verdict = diff > 0 ? 'b_better' : 'a_better'
  return result
}
