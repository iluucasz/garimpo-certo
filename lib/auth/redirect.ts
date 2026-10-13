/**
 * Destino depois de entrar. Só aceita caminhos do próprio site (`/convite/abc`), nunca endereços externos:
 * `?next=https://outro-site` ou `?next=//outro-site` viram o padrão.
 */
export function safeRedirect(value: string | string[] | null | undefined, fallback = '/conta') {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return fallback
  return raw.length > 300 ? fallback : raw
}
