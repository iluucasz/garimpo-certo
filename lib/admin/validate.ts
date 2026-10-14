/** Validação dos formulários do painel, a partir dos metadados em resource-meta. Roda no servidor (autoridade) e no cliente (aviso rápido). */
import type { ResourceField, ResourceMeta } from './resource-meta'

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const codePattern = /^[a-z0-9][a-z0-9_.-]*$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Values = Record<string, unknown>
export type ValidationResult = { values: Values; errors: Record<string, string> }

export function slugify(input: string) {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

/** Aceita caminhos do site (/colecoes/x) e URLs https. Bloqueia javascript:, data: e protocolos estranhos. */
export function isSafeLink(value: string) {
  if (/^\/(?!\/)[^\s]*$/.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function validateResource(meta: ResourceMeta, input: unknown, mode: 'create' | 'update'): ValidationResult {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Values : {}
  const values: Values = {}
  const errors: Record<string, string> = {}

  for (const field of meta.fields) {
    if (field.readOnly || field.listOnly) continue
    if (field.createOnly && mode === 'update') continue
    // Em atualização parcial só valida o que veio.
    if (mode === 'update' && !(field.key in source)) continue
    const result = coerce(field, source[field.key], meta.slug)
    if ('error' in result) errors[field.key] = result.error
    else values[field.key] = result.value
  }
  return { values, errors }
}

function coerce(field: ResourceField, raw: unknown, slug: string): { value: unknown } | { error: string } {
  const empty = raw === undefined || raw === null || raw === ''
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'url': {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (!text) return field.required ? { error: 'Campo obrigatório.' } : { value: null }
      if (field.maxLength && text.length > field.maxLength) return { error: `No máximo ${field.maxLength} caracteres.` }
      if (field.key === 'slug' && !slugPattern.test(text)) return { error: 'Use só letras minúsculas, números e hífen (ex.: minha-colecao).' }
      if (field.key === 'code' && slug === 'tags' && !codePattern.test(text)) return { error: 'Use só letras minúsculas, números, hífen e sublinhado.' }
      if (field.key === 'key' && !codePattern.test(text)) return { error: 'Use só letras minúsculas, números, ponto, hífen e sublinhado.' }
      if (field.type === 'url' && !/^https?:\/\/[^\s]+$/i.test(text)) return { error: 'Use um endereço completo começando com https://.' }
      if (field.key === 'ctaUrl' && !isSafeLink(text)) return { error: 'Use um caminho do site (/algo) ou um endereço https://.' }
      return { value: text }
    }
    case 'number': {
      if (empty) return field.required ? { error: 'Campo obrigatório.' } : { value: null }
      const number = Number(raw)
      if (!Number.isFinite(number)) return { error: 'Informe um número.' }
      if (field.min !== undefined && number < field.min) return { error: `O mínimo é ${field.min}.` }
      if (field.max !== undefined && number > field.max) return { error: `O máximo é ${field.max}.` }
      return { value: number }
    }
    case 'boolean':
      return { value: raw === true || raw === 'true' }
    case 'select': {
      if (empty) return field.required ? { error: 'Escolha uma opção.' } : { value: null }
      if (field.options && !field.options.some((option) => option.value === raw)) return { error: 'Opção inválida.' }
      return { value: String(raw) }
    }
    case 'datetime': {
      if (empty) return field.required ? { error: 'Informe a data.' } : { value: null }
      const date = new Date(String(raw))
      if (Number.isNaN(date.getTime())) return { error: 'Data inválida.' }
      return { value: date.toISOString() }
    }
    case 'multi':
    case 'products': {
      if (!Array.isArray(raw)) return { value: [] }
      const ids = raw.map(String).filter((id) => uuidPattern.test(id))
      return { value: [...new Set(ids)].slice(0, field.type === 'products' ? 120 : 60) }
    }
    case 'rules':
      return { value: raw ?? { windowDays: 30, conditions: [] } }
    case 'json':
      return { value: raw ?? null }
    case 'image':
      // Foto só de leitura (miniatura na tabela): nunca vem do formulário.
      return { value: null }
  }
}

/** Intervalo coerente para campos de período. */
export function validatePeriod(values: Values, startKey = 'startsAt', endKey = 'endsAt'): string | null {
  const start = typeof values[startKey] === 'string' ? new Date(values[startKey] as string).getTime() : null
  const end = typeof values[endKey] === 'string' ? new Date(values[endKey] as string).getTime() : null
  if (start !== null && end !== null && end <= start) return 'O fim precisa ser depois do início.'
  return null
}
