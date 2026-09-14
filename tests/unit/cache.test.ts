import { describe, expect, it } from 'vitest'
import { mockCache } from '@/lib/server/mock-cache'
describe('cache em memória', () => {
  it('invalida por namespace', () => {
    mockCache.set('product:1', { ok: true })
    mockCache.set('category:1', { ok: true })
    expect(mockCache.invalidate('product:')).toBe(1)
    expect(mockCache.get('category:1')).toEqual({ ok: true })
  })
})
