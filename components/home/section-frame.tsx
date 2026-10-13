import type { CSSProperties } from 'react'
import { isFreeBlock, type Section } from '@/lib/site-builder/document'
import { INK, readableOn } from '@/lib/site-builder/visual'
import styles from './section-frame.module.css'

/** O que a aparência da seção (fundo, cor do texto, espaçamento, largura) muda no estilo do invólucro. */
function frameStyle(section: Section): CSSProperties | undefined {
  const { background, color, padding } = section.settings
  const style: Record<string, string | number> = {}
  if (background) style.background = background
  if (padding !== undefined) style.paddingBlock = padding
  // Só blocos livres trocam a cor do texto: as seções do site (vitrine, guias...) mantêm o texto escuro.
  const text = isFreeBlock(section.type) ? color ?? (background ? readableOn(background) : undefined) : undefined
  if (text) {
    style.color = text
    style['--foreground'] = text
    style['--muted-foreground'] = `color-mix(in srgb, ${text} 78%, transparent)`
    style['--border'] = `color-mix(in srgb, ${text} 24%, transparent)`
    // Os cartões e faixas do bloco ficam transparentes sobre o fundo escolhido; o tom "escuro" mantém a tinta da marca.
    style['--surface'] = 'transparent'
    style['--surface-sunken'] = 'transparent'
    style['--ink'] = INK
  }
  return Object.keys(style).length ? style as CSSProperties : undefined
}

/**
 * Invólucro de cada seção da página. No site público só existe quando a seção tem aparência própria (fundo,
 * cor, espaçamento ou largura); na prévia do editor existe sempre, com `data-cms-section`, para o clique na
 * página selecionar a seção.
 */
export function SectionFrame({ section, preview, children }: { section: Section; preview: boolean; children: React.ReactNode }) {
  const style = frameStyle(section)
  const full = section.settings.width === 'full'
  if (!style && !full && !preview) return <>{children}</>
  return <div
    className={full ? styles.full : undefined}
    style={style}
    {...(preview ? { 'data-cms-section': section.id, 'data-cms-name': section.name } : {})}
  >{children}</div>
}
