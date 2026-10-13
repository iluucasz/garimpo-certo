/** Cores e contraste das seções. Isomórfico: o painel avisa e o servidor valida com as mesmas contas. */

/** Azul-marinho da marca: o texto padrão da vitrine. */
export const INK = '#172642'
export const WHITE = '#ffffff'

const channel = (value: number) => {
  const unit = value / 255
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => channel(parseInt(hex.slice(index, index + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG entre duas cores #rrggbb (1 a 21). */
export function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** Cor de texto legível sobre um fundo: branco ou o azul da marca, o que contrastar mais. */
export const readableOn = (background: string) => (contrast(background, WHITE) >= contrast(background, INK) ? WHITE : INK)

/** Fundo claro o bastante para o texto escuro das seções do site (que não trocam de cor). */
export const isLightEnough = (background: string) => contrast(background, INK) >= 4.5
