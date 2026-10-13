/**
 * Consentimento de medição.
 *
 * Eventos de uso da vitrine (favoritar, comparar, ver produto...) só são enviados ao servidor
 * quando a pessoa permitiu a categoria "analytics". Ações do painel administrativo não passam
 * por aqui: são operações de equipe, não medição de visitantes.
 */

export const COOKIE_PREFERENCES_KEY = 'garimpo:cookie-preferences'

/** Eventos disparados por quem navega na vitrine. Qualquer outro nome é tratado como operação interna. */
const STOREFRONT_EVENTS = new Set([
  'favorite_toggled',
  'favorite_added',
  'favorite_removed',
  'compare_updated',
  'product_viewed',
  'preferences_updated',
  'search_suggestion_selected',
])

export function isStorefrontEvent(name: string, actor?: string) {
  return STOREFRONT_EVENTS.has(name) || actor === 'visitor'
}

/** Lê o valor bruto salvo no navegador e decide se a medição está permitida. Sem escolha = não permitida. */
export function analyticsAllowed(raw: string | null | undefined) {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as { analytics?: unknown }
    return parsed.analytics === true
  } catch {
    return false
  }
}

export function shouldTrackEvent(event: { name: string; actor?: string }, storedPreferences: string | null | undefined) {
  if (!isStorefrontEvent(event.name, event.actor)) return true
  return analyticsAllowed(storedPreferences)
}

/** Versão para o navegador; fora dele (SSR) nunca há medição de visitante. */
export function readStoredPreferences() {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(COOKIE_PREFERENCES_KEY) } catch { return null }
}
