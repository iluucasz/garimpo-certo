import { contrastWithWhite } from '@/lib/admin/settings-defs'

type Rgb = [number, number, number]

const parse = (hex: string): Rgb => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as Rgb
const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`
const mix = (a: Rgb, b: Rgb, weight: number): Rgb => [0, 1, 2].map((index) => a[index] * (1 - weight) + b[index] * weight) as Rgb

/** Escurece até o contraste com branco atingir `target` (para texto de destaque sobre fundo claro). */
function darkenUntil(hex: string, target: number) {
  let current = hex
  for (let step = 0; step < 20 && contrastWithWhite(current) < target; step++) current = toHex(mix(parse(current), [0, 0, 0], 0.08))
  return current
}

const radii = {
  compact: { sm: '3px', md: '5px', lg: '8px' },
  default: { sm: '6px', md: '10px', lg: '16px' },
  round: { sm: '10px', md: '16px', lg: '24px' },
} as const

/**
 * Variáveis CSS da vitrine derivadas da cor de ação escolhida no painel. Os tons de hover/ativo/destaque
 * são calculados para manter o contraste de texto, de modo que qualquer cor válida continue legível.
 */
export function deriveTheme(primary: string, radius: string): Record<string, string> {
  const base = /^#[0-9a-f]{6}$/i.test(primary) ? primary.toLowerCase() : '#c3441d'
  const rgb = parse(base)
  const size = radii[radius as keyof typeof radii] ?? radii.default
  return {
    '--primary': base,
    '--primary-hover': toHex(mix(rgb, [0, 0, 0], 0.14)),
    '--primary-active': toHex(mix(rgb, [0, 0, 0], 0.26)),
    '--primary-ink': darkenUntil(base, 6),
    '--primary-soft': toHex(mix(rgb, [255, 255, 255], 0.9)),
    '--focus-ring': `0 0 0 3px rgb(${rgb.join(' ')} / 32%)`,
    '--radius-sm': size.sm,
    '--radius-md': size.md,
    '--radius-lg': size.lg,
  }
}

export const isDefaultTheme = (primary: string, radius: string) => primary.toLowerCase() === '#c3441d' && radius === 'default'
