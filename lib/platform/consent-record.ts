const CONSENT_ID_KEY = 'garimpo:consent-id'

/** Identificador aleatório do navegador, criado só quando a pessoa faz uma escolha. Serve de prova de consentimento. */
function consentId() {
  try {
    const existing = window.localStorage.getItem(CONSENT_ID_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(CONSENT_ID_KEY, created)
    return created
  } catch {
    return null
  }
}

/**
 * Envia a escolha de privacidade ao servidor, que a guarda como registro de consentimento.
 * Nunca bloqueia nem quebra a interface: falha em silêncio (a escolha continua valendo no navegador).
 */
export function recordConsent(preferences: { analytics: boolean; personalization: boolean; marketing: boolean }) {
  if (typeof window === 'undefined') return
  const id = consentId()
  if (!id) return
  void fetch('/api/v1/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ id, analytics: preferences.analytics, personalization: preferences.personalization, marketing: preferences.marketing }),
  }).catch(() => undefined)
}

/** Ao limpar os dados locais, o identificador também sai. */
export function forgetConsentId() {
  try { window.localStorage.removeItem(CONSENT_ID_KEY) } catch { /* sem armazenamento */ }
}
