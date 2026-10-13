'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  defaultDesign, fontOptions, MAX_FOOTER_LINKS, radiusOptions, type FooterLink, type SiteDesign, type ThemeFont, type ThemeRadius,
} from '@/lib/site-builder/design'
import { newId } from '@/lib/site-builder/document'
import { contrast, WHITE } from '@/lib/site-builder/visual'
import { ColorField, TextInput } from './fields'
import styles from './site-builder.module.css'

export type DesignArea = 'theme' | 'header' | 'footer'

export const designAreas: { id: DesignArea; label: string; description: string }[] = [
  { id: 'theme', label: 'Tema', description: 'Cor de ação, cantos e fonte do site inteiro.' },
  { id: 'header', label: 'Aviso do topo', description: 'A faixa acima do menu.' },
  { id: 'footer', label: 'Rodapé', description: 'Texto de apresentação e links extras.' },
]

type Props = {
  area: DesignArea
  design: SiteDesign
  canWrite: boolean
  errors: Record<string, string>
  onChange: (mutate: (design: SiteDesign) => SiteDesign, group: string) => void
}

/** Ajustes do documento "Aparência do site": valem para todas as páginas. */
export function DesignInspector({ area, design, canWrite, errors, onChange }: Props) {
  const original = defaultDesign()

  if (area === 'theme') {
    const ratio = contrast(design.theme.primary, WHITE)
    const radius = { compact: 4, default: 10, round: 18 }[design.theme.radius]
    return <div className={styles.inspectorBody}>
      <header className={styles.inspectorHead}><span className={styles.overline}>Aparência do site</span><h2>Tema</h2><p className={styles.help}>Vale para todas as páginas, depois de publicar.</p></header>
      <ColorField
        label="Cor de ação (botões e destaques)" value={design.theme.primary} disabled={!canWrite} error={errors['design.theme.primary']}
        help={`Contraste de ${ratio.toFixed(1)}:1 com texto branco. O mínimo é 4,5:1 para o botão continuar legível.`}
        onChange={(primary) => onChange((current) => ({ ...current, theme: { ...current.theme, primary } }), 'theme-primary')}
        reset={design.theme.primary !== original.theme.primary ? () => onChange((current) => ({ ...current, theme: { ...current.theme, primary: original.theme.primary } }), 'theme-primary') : undefined}
      />
      <div className={styles.field}>
        <label htmlFor="theme-radius">Cantos</label>
        <select id="theme-radius" value={design.theme.radius} disabled={!canWrite} onChange={(event) => onChange((current) => ({ ...current, theme: { ...current.theme, radius: event.target.value as ThemeRadius } }), 'theme-radius')}>
          {radiusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="theme-font">Fonte</label>
        <select id="theme-font" value={design.theme.font} disabled={!canWrite} onChange={(event) => onChange((current) => ({ ...current, theme: { ...current.theme, font: event.target.value as ThemeFont } }), 'theme-font')}>
          {fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className={styles.themeSample} style={{ borderRadius: radius }} aria-hidden="true">
        <strong>Seu próximo achado.</strong>
        <p>Uma prévia dos botões e dos cantos.</p>
        <span style={{ background: design.theme.primary, borderRadius: radius }}>Ver ofertas</span>
      </div>
    </div>
  }

  if (area === 'header') {
    return <div className={styles.inspectorBody}>
      <header className={styles.inspectorHead}><span className={styles.overline}>Aparência do site</span><h2>Aviso do topo</h2><p className={styles.help}>A faixa acima do menu. Deixe o texto vazio para ocultar.</p></header>
      <TextInput label="Texto do aviso" value={design.header.noticeText} maxLength={140} disabled={!canWrite} help="Mantenha a menção a links de afiliado." onChange={(noticeText) => onChange((current) => ({ ...current, header: { ...current.header, noticeText } }), 'header-text')}/>
      <TextInput label="Complemento" value={design.header.noticeDetail} maxLength={140} disabled={!canWrite} onChange={(noticeDetail) => onChange((current) => ({ ...current, header: { ...current.header, noticeDetail } }), 'header-detail')}/>
    </div>
  }

  const links = design.footer.links
  const setLinks = (next: FooterLink[], group = '') => onChange((current) => ({ ...current, footer: { ...current.footer, links: next } }), group)
  const patchLink = (index: number, change: Partial<FooterLink>) => setLinks(links.map((link, position) => position === index ? { ...link, ...change } : link), `footer-link-${index}`)
  const swap = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= links.length) return
    const next = [...links]
    ;[next[index], next[target]] = [next[target], next[index]]
    setLinks(next)
  }
  return <div className={styles.inspectorBody}>
    <header className={styles.inspectorHead}><span className={styles.overline}>Aparência do site</span><h2>Rodapé</h2><p className={styles.help}>Os links de navegação do rodapé continuam os do site; aqui você escreve a apresentação e adiciona links.</p></header>
    <TextInput label="Frase de apresentação" value={design.footer.tagline} multiline rows={3} maxLength={200} disabled={!canWrite} help="Cada linha vira uma quebra." onChange={(tagline) => onChange((current) => ({ ...current, footer: { ...current.footer, tagline } }), 'footer-tagline')}/>
    <TextInput label="Assinatura" value={design.footer.signature} maxLength={80} disabled={!canWrite} onChange={(signature) => onChange((current) => ({ ...current, footer: { ...current.footer, signature } }), 'footer-signature')}/>
    <fieldset className={styles.items}>
      <legend>Links extras ({links.length}/{MAX_FOOTER_LINKS})</legend>
      {links.length === 0 && <p className={styles.help}>Aparecem na coluna “Sobre”. Use para páginas criadas aqui, por exemplo /paginas/dia-das-maes.</p>}
      {links.map((link, index) => <div className={styles.item} key={link.id}>
        <div className={styles.itemHead}>
          <strong>Link {index + 1}</strong>
          {canWrite && <span className={styles.rowActions}>
            <button type="button" onClick={() => swap(index, -1)} disabled={index === 0} aria-label={`Subir link ${index + 1}`}><ArrowUp aria-hidden="true"/></button>
            <button type="button" onClick={() => swap(index, 1)} disabled={index === links.length - 1} aria-label={`Descer link ${index + 1}`}><ArrowDown aria-hidden="true"/></button>
            <button type="button" onClick={() => setLinks(links.filter((_, position) => position !== index))} aria-label={`Remover link ${index + 1}`}><Trash2 aria-hidden="true"/></button>
          </span>}
        </div>
        <TextInput label="Nome" value={link.label} maxLength={40} disabled={!canWrite} error={errors[`design.footer.links.${index}.label`]} onChange={(label) => patchLink(index, { label })}/>
        <TextInput label="Endereço" value={link.href} placeholder="/paginas/exemplo ou https://…" disabled={!canWrite} error={errors[`design.footer.links.${index}.href`]} onChange={(href) => patchLink(index, { href })}/>
      </div>)}
      {canWrite && links.length < MAX_FOOTER_LINKS && <button type="button" className="btn secondary" onClick={() => setLinks([...links, { id: newId(), label: '', href: '' }])}><Plus aria-hidden="true"/> Adicionar link</button>}
    </fieldset>
  </div>
}
