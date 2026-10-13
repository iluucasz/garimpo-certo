import { getSetting } from '@/lib/settings'
import { resolveChecklists } from './guides'
import { resolveRules } from './rules'

/** Regras de coleções e filtros editadas no painel (Experiência → Regras do catálogo), sobre os padrões do código. */
export async function getCatalogRules() {
  return resolveRules(await getSetting('rules'))
}

/** Textos de “O que observar antes de comprar” editados no painel (Conteúdo → Guias de compra). */
export async function getGuideChecklists() {
  return resolveChecklists(await getSetting('guides'))
}
