import { describe, expect, it } from 'vitest'
import { analyticsAllowed, isStorefrontEvent, shouldTrackEvent } from '@/lib/platform/consent'

const allowed = JSON.stringify({ essential: true, analytics: true, personalization: false, marketing: false })
const denied = JSON.stringify({ essential: true, analytics: false, personalization: true, marketing: true })

describe('consentimento de medição', () => {
  it('sem escolha salva, medição não é permitida', () => {
    expect(analyticsAllowed(null)).toBe(false)
    expect(analyticsAllowed(undefined)).toBe(false)
    expect(analyticsAllowed('')).toBe(false)
  })

  it('valor corrompido nunca libera a medição', () => {
    expect(analyticsAllowed('{not json')).toBe(false)
    expect(analyticsAllowed(JSON.stringify({ analytics: 'true' }))).toBe(false)
  })

  it('só analytics=true libera; outras categorias não contam', () => {
    expect(analyticsAllowed(allowed)).toBe(true)
    expect(analyticsAllowed(denied)).toBe(false)
  })

  it('bloqueia eventos de vitrine sem permissão e libera com ela', () => {
    const favorite = { name: 'favorite_added', actor: 'visitor' }
    expect(shouldTrackEvent(favorite, null)).toBe(false)
    expect(shouldTrackEvent(favorite, denied)).toBe(false)
    expect(shouldTrackEvent(favorite, allowed)).toBe(true)
  })

  it('bloqueia favorito de usuário logado, que usa o id como ator', () => {
    expect(shouldTrackEvent({ name: 'favorite_toggled', actor: 'user-123' }, denied)).toBe(false)
  })

  it('não bloqueia operações internas do painel administrativo', () => {
    for (const name of ['admin_record_created', 'provider_sync_started', 'studio_version_published', 'settings_updated']) {
      expect(isStorefrontEvent(name, 'Marina')).toBe(false)
      expect(shouldTrackEvent({ name, actor: 'Marina' }, null)).toBe(true)
    }
  })
})
