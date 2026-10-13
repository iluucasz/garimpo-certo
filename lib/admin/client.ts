/** Chamadas do painel à API. Devolve `data` ou lança AdminApiError com a mensagem em português e os erros por campo. */
export class AdminApiError extends Error {
  constructor(message: string, readonly status: number, readonly fields: Record<string, string> = {}) {
    super(message)
    this.name = 'AdminApiError'
  }
}

type Envelope<T> = { data: T; error?: { message: string; details?: Record<string, string> } }

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) },
  })
  const body = await response.json().catch(() => null) as (Envelope<T> & { error?: Envelope<T>['error'] }) | null
  if (!response.ok) {
    throw new AdminApiError(body?.error?.message ?? `Falha na requisição (${response.status}).`, response.status, body?.error?.details ?? {})
  }
  return (body as Envelope<T>).data
}

export const swrFetcher = <T,>(url: string) => adminFetch<T>(url)

export const dateTime = (iso: string | null | undefined) => iso
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
  : '—'

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
