'use client'

import { experimentTag, type Variant } from './core'

/**
 * Parte do teste A/B que roda no navegador. Tudo aqui só é chamado com a medição de uso permitida: sem ela
 * não se cria identificador, não se sorteia e não se envia nada.
 */

const VISITOR_KEY = 'garimpo:ab-id'
const EXPOSED_KEY = 'garimpo:ab-exposed'
const SESSION_KEY = 'garimpo:session'

/** Identificador aleatório do navegador, só para o sorteio ser estável entre visitas. Nunca sai do aparelho. */
export function visitorBucketId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(VISITOR_KEY, created)
    return created
  } catch {
    return null
  }
}

function sessionId() {
  try {
    const current = window.sessionStorage.getItem(SESSION_KEY)
    if (current) return current
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

/** Registra, uma vez por aba, que a pessoa viu a variante, e guarda a escolha para marcar os cliques de compra. */
export function registerExposure(key: string, variant: Variant) {
  try {
    const stored = window.sessionStorage.getItem(EXPOSED_KEY)
    if (stored && (JSON.parse(stored) as { key?: string }).key === key) return
    window.sessionStorage.setItem(EXPOSED_KEY, JSON.stringify({ key, variant }))
  } catch { /* sem armazenamento: ainda assim tenta registrar */ }
  void fetch('/api/v1/experiments/exposure', {
    method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, variant, sessionId: sessionId() }),
  }).catch(() => undefined)
}

/** Etiqueta (`<teste>-<variante>`) do teste que esta aba viu, para o clique de compra carregar. */
export function currentExperimentTag() {
  try {
    const stored = window.sessionStorage.getItem(EXPOSED_KEY)
    if (!stored) return null
    const { key, variant } = JSON.parse(stored) as { key?: string; variant?: Variant }
    return key && (variant === 'a' || variant === 'b') ? experimentTag(key, variant) : null
  } catch {
    return null
  }
}
