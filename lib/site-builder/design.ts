/**
 * Design global do site (tema, aviso do topo e rodapé), editado no editor visual em "Aparência do site".
 *
 * Fica num documento próprio (chave `global`) com rascunho, publicação e histórico, igual às páginas. Sem
 * publicação, vale o que está em Configurações → Tema (`theme`), então o site não muda até alguém publicar.
 *
 * A paleta é de propósito curta: o Garimpo usa uma cor por papel (laranja só para ação), então o editor
 * expõe a cor de ação, os cantos e a fonte, e o contraste da cor de ação segue a mesma regra do painel de Tema.
 */
import { contrastWithWhite } from '@/lib/admin/settings-defs'
import { deriveTheme, isDefaultTheme } from '@/lib/theme'
import { clip, isHex, newId, safeLink, type DocumentErrors } from './validate'

export type ThemeRadius = 'compact' | 'default' | 'round'
export type ThemeFont = 'default' | 'serif' | 'system'
export type FooterLink = { id: string; label: string; href: string }

export type SiteDesign = {
  theme: { primary: string; radius: ThemeRadius; font: ThemeFont }
  header: { noticeText: string; noticeDetail: string }
  footer: { tagline: string; signature: string; links: FooterLink[] }
}

export const MAX_FOOTER_LINKS = 8
export const DEFAULT_PRIMARY = '#c3441d'

export const radiusOptions: { value: ThemeRadius; label: string }[] = [
  { value: 'compact', label: 'Retos (compacto)' },
  { value: 'default', label: 'Arredondados (padrão)' },
  { value: 'round', label: 'Bem arredondados' },
]
export const fontOptions: { value: ThemeFont; label: string }[] = [
  { value: 'default', label: 'Padrão do Garimpo' },
  { value: 'serif', label: 'Georgia · editorial' },
  { value: 'system', label: 'Sistema · neutra' },
]

export const defaultFooter: SiteDesign['footer'] = {
  tagline: '',
  signature: '',
  links: [],
}

const oneOf = <T extends string>(options: { value: T }[], value: unknown, fallback: T): T => options.find((option) => option.value === value)?.value ?? fallback

/** Design equivalente ao site de hoje, a partir do que já está em Configurações → Tema. */
export function defaultDesign(theme: Record<string, unknown> = {}): SiteDesign {
  const text = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)
  return {
    theme: {
      primary: isHex(theme.primary) ? theme.primary.toLowerCase() : DEFAULT_PRIMARY,
      radius: oneOf(radiusOptions, theme.radius, 'default'),
      font: 'default',
    },
    header: {
      noticeText: text(theme.noticeText, ''),
      noticeDetail: text(theme.noticeDetail, ''),
    },
    footer: { ...defaultFooter, links: [] },
  }
}

/** Valida o design recebido. O que faltar usa o padrão; campos desconhecidos são descartados. */
export function normalizeDesign(input: unknown, path: string, errors: DocumentErrors): SiteDesign {
  const base = defaultDesign()
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const obj = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const theme = obj(source.theme)
  const header = obj(source.header)
  const footer = obj(source.footer)

  let primary = base.theme.primary
  if (typeof theme.primary === 'string' && theme.primary) {
    if (!isHex(theme.primary)) errors[`${path}.theme.primary`] = 'Use uma cor no formato #rrggbb.'
    else if (contrastWithWhite(theme.primary) < 4.5) errors[`${path}.theme.primary`] = `Contraste de ${contrastWithWhite(theme.primary).toFixed(1)}:1 com branco é baixo demais (mínimo 4,5:1). Escolha uma cor mais escura.`
    else primary = theme.primary.toLowerCase()
  }

  const links = (Array.isArray(footer.links) ? footer.links : []).slice(0, MAX_FOOTER_LINKS).flatMap((entry, index): FooterLink[] => {
    const item = obj(entry)
    const label = clip(item.label, 40)
    const href = clip(item.href, 2048)
    if (!label && !href) return []
    if (!label) { errors[`${path}.footer.links.${index}.label`] = 'Dê um nome ao link.'; return [] }
    if (!href || !safeLink(href)) { errors[`${path}.footer.links.${index}.href`] = 'Use um caminho do site (/colecoes) ou um endereço https.'; return [] }
    return [{ id: clip(item.id, 40).replace(/[^\w-]/g, '') || newId(), label, href }]
  })

  const tagline = typeof footer.tagline === 'string' ? clip(footer.tagline, 200) : defaultFooter.tagline
  const signature = typeof footer.signature === 'string' ? clip(footer.signature, 80) : defaultFooter.signature
  const noticeText = typeof header.noticeText === 'string' ? clip(header.noticeText, 140) : base.header.noticeText
  const noticeDetail = typeof header.noticeDetail === 'string' ? clip(header.noticeDetail, 140) : base.header.noticeDetail

  return {
    theme: { primary, radius: oneOf(radiusOptions, theme.radius, 'default'), font: oneOf(fontOptions, theme.font, 'default') },
    header: { noticeText, noticeDetail },
    footer: { tagline, signature, links },
  }
}

const fontStack: Record<Exclude<ThemeFont, 'default'>, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}

/** Variáveis CSS que a casca da vitrine aplica (vazio = tema original, sem estilo extra). */
export function themeVariables(design: SiteDesign): Record<string, string> {
  const { primary, radius, font } = design.theme
  const base = isDefaultTheme(primary, radius) ? {} : deriveTheme(primary, radius)
  // `fontFamily` (camelCase) é uma propriedade de estilo do React; as duas variáveis cobrem o que usa var(--font-*).
  return font === 'default' ? base : { ...base, '--font-body': fontStack[font], '--font-display': fontStack[font], fontFamily: fontStack[font] }
}
