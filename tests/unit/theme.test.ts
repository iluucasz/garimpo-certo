import { describe, expect, it } from 'vitest'
import { contrastWithWhite } from '@/lib/admin/settings-defs'
import { deriveTheme, isDefaultTheme } from '@/lib/theme'

describe('tema da vitrine', () => {
  it('deriva tons de hover e destaque mais escuros que a cor de ação', () => {
    const theme = deriveTheme('#1d4ed8', 'default')
    expect(theme['--primary']).toBe('#1d4ed8')
    expect(contrastWithWhite(theme['--primary-hover'])).toBeGreaterThan(contrastWithWhite('#1d4ed8'))
    expect(contrastWithWhite(theme['--primary-active'])).toBeGreaterThan(contrastWithWhite(theme['--primary-hover']))
  })

  it('o tom de destaque para texto mantém contraste de leitura', () => {
    for (const color of ['#c3441d', '#0f766e', '#6d28d9', '#b45309']) {
      expect(contrastWithWhite(deriveTheme(color, 'default')['--primary-ink'])).toBeGreaterThanOrEqual(6)
    }
  })

  it('cai na cor original com valor inválido e conhece o tema padrão', () => {
    expect(deriveTheme('vermelho', 'default')['--primary']).toBe('#c3441d')
    expect(isDefaultTheme('#C3441D', 'default')).toBe(true)
    expect(isDefaultTheme('#1d4ed8', 'default')).toBe(false)
  })

  it('aplica o raio escolhido', () => {
    expect(deriveTheme('#c3441d', 'round')['--radius-md']).toBe('16px')
    expect(deriveTheme('#c3441d', 'compact')['--radius-md']).toBe('5px')
  })
})
