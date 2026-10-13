/**
 * Limiares das coleções automáticas e dos filtros de "Escolha pelo que importa" (/buscar, home, /colecoes).
 * Isomórfico: o painel edita estes valores (Experiência → Regras do catálogo) e o site os lê com
 * `resolveRules(await getSetting('rules'))`. Os padrões abaixo são os critérios originais do site.
 */
export type CatalogRules = {
  /** Vendas recentes para "Viralizou na Shopee". */
  viralSales: number
  /** Vendas recentes para "Mais vendidos" (coleção e filtro). */
  topSales: number
  /** Vendas e nota mínimas de "Queridinhos". */
  lovedSales: number
  lovedRating: number
  /** Preço máximo, nota e vendas mínimas de "Achadinhos". */
  findsPrice: number
  findsRating: number
  findsSales: number
  /** Desconto mínimo (em %) de "Em promoção" e de "Desconto pesado". */
  promoDiscount: number
  heavyDiscount: number
  /** Preço mínimo de "Acima de R$ 500" (o nome da coleção continua o mesmo; o texto acompanha o valor). */
  premiumPrice: number
  /** Nota mínima de "Bem avaliados" (coleção e filtro) e de "Nota máxima". */
  topRating: number
  perfectRating: number
  /** "Bom custo-benefício": Índice Garimpo mínimo e preço máximo. */
  valueScore: number
  valuePriceMax: number
}

export const defaultCatalogRules: CatalogRules = {
  viralSales: 10_000,
  topSales: 1_000,
  lovedSales: 1_000,
  lovedRating: 4.8,
  findsPrice: 30,
  findsRating: 4.7,
  findsSales: 500,
  promoDiscount: 20,
  heavyDiscount: 40,
  premiumPrice: 500,
  topRating: 4.8,
  perfectRating: 4.9,
  valueScore: 85,
  valuePriceMax: 1_500,
}

export const catalogRuleKeys = Object.keys(defaultCatalogRules) as (keyof CatalogRules)[]

/** Completa com os padrões e descarta o que não for número finito e positivo. Nunca lança. */
export function resolveRules(value?: Record<string, unknown> | null): CatalogRules {
  const rules = { ...defaultCatalogRules }
  if (!value || typeof value !== 'object') return rules
  for (const key of catalogRuleKeys) {
    const parsed = Number(value[key])
    if (Number.isFinite(parsed) && parsed > 0) rules[key] = parsed
  }
  return rules
}

/** `10000` → "10 mil", `1000` → "mil", `500` → "500". Para os textos das coleções acompanharem a regra. */
export function salesLabel(value: number) {
  if (value === 1000) return 'mil'
  if (value >= 1000) return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return value.toLocaleString('pt-BR')
}

export const ratingLabel = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const moneyLabel = (value: number) => `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
