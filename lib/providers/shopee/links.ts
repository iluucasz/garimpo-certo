/**
 * Etiquetas de origem (sub ids) dos links de afiliado.
 *
 * A Shopee devolve a etiqueta no relatório de conversões (`utmContent`), então é ela que liga uma comissão ao canal
 * e à campanha que a gerou. Regras da API, confirmadas em chamada real: só letras e números (hífen e sublinhado
 * dão o erro 11001), até 5 etiquetas, e o relatório as junta com "-" (ex.: `site-tecnologia---`).
 */

export const SUB_ID_MAX = 30

/** Tira acentos e tudo que não é letra ou número; é o formato que a Shopee aceita. */
export function toSubId(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, SUB_ID_MAX)
}

/** Etiquetas dos links que o site usa nos botões de compra: canal e categoria do produto. */
export function siteSubIds(categorySlug: string) {
  return ['site', toSubId(categorySlug) || 'geral']
}

/** Forma gravada em `offers.affiliate_sub_ids` e em `affiliate_conversions.sub_ids`. */
export const subIdsKey = (subIds: string[]) => subIds.map(toSubId).filter(Boolean).join('-')

/** `site-tecnologia---` → `site-tecnologia`; vazio (link sem etiqueta) → null. */
export function parseUtmContent(value: string | null | undefined) {
  const key = (value ?? '').split('-').map((part) => part.trim()).filter(Boolean).join('-')
  return key || null
}

/** Primeiro nível da etiqueta: o canal (`site`, `telegram`...). Sem etiqueta, `sem-origem`. */
export const channelOf = (subIds: string | null | undefined) => parseUtmContent(subIds)?.split('-')[0] ?? 'sem-origem'

/** Segundo nível: a categoria (no site) ou a campanha (nos canais). */
export const detailOf = (subIds: string | null | undefined) => parseUtmContent(subIds)?.split('-')[1] ?? null
