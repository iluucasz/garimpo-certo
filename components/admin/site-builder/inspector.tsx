'use client'

import Link from 'next/link'
import { Archive, Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import { MAX_PADDING, sectionTypes, type PageMeta, type Section, type SectionSettings } from '@/lib/site-builder/document'
import { contrast, INK, readableOn, WHITE } from '@/lib/site-builder/visual'
import { ColorField, FieldControl, TextInput, type CollectionOption } from './fields'
import styles from './site-builder.module.css'

type SectionInspectorProps = {
  section: Section
  /** Posição no documento: as mensagens do servidor citam este índice. */
  index: number
  canWrite: boolean
  errors: Record<string, string>
  collections: CollectionOption[]
  onName: (name: string) => void
  onSettings: (patch: Partial<Record<keyof SectionSettings, unknown>>, group?: string) => void
  onDuplicate: () => void
  onToggleHidden: () => void
  onArchive: () => void
}

/** Ajustes da seção escolhida: conteúdo (por tipo), aparência e ações. */
export function SectionInspector({ section, index, canWrite, errors, collections, onName, onSettings, onDuplicate, onToggleHidden, onArchive }: SectionInspectorProps) {
  const definition = sectionTypes[section.type]
  const s = section.settings
  const base = `sections.${index}.settings`
  const free = !definition.builtin
  const effectiveBackground = s.background ?? WHITE
  const effectiveColor = s.color ?? (s.background ? readableOn(s.background) : INK)
  const ratio = contrast(effectiveBackground, effectiveColor)
  // O aviso só vale quando a pessoa escolheu a cor do texto: sem ela, o editor escolhe uma legível.
  const lowContrast = free && Boolean(s.color) && ratio < 4.5

  return <div className={styles.inspectorBody}>
    <header className={styles.inspectorHead}>
      <span className={styles.overline}>Seção</span>
      <h2>{definition.label}</h2>
    </header>

    {canWrite && <div className={styles.toolRow}>
      {free && <button type="button" className="btn secondary" onClick={onDuplicate}><Copy aria-hidden="true"/> Duplicar</button>}
      <button type="button" className="btn secondary" onClick={onToggleHidden}>{section.hidden ? <Eye aria-hidden="true"/> : <EyeOff aria-hidden="true"/>} {section.hidden ? 'Mostrar' : 'Ocultar'}</button>
      <button type="button" className="btn secondary" onClick={onArchive}><Archive aria-hidden="true"/> Arquivar</button>
    </div>}

    <TextInput label="Nome na lista de seções" value={section.name} maxLength={80} disabled={!canWrite} onChange={onName}/>

    <h3>Conteúdo</h3>
    {definition.fields.length === 0 && <p className={styles.help}>Sem textos para ajustar.</p>}
    {definition.fields.map((field) => <FieldControl key={field.key} field={field} settings={s} disabled={!canWrite} errors={errors} path={`${base}.${field.key}`} collections={collections} onChange={(patch) => onSettings(patch, `${section.id}-${field.key}`)}/>)}

    <h3>Aparência</h3>
    <ColorField
      label="Fundo da seção" value={s.background ?? WHITE} disabled={!canWrite} error={errors[`${base}.background`]}
      help={free ? undefined : 'Esta seção mantém o texto escuro: use um fundo claro.'}
      onChange={(value) => onSettings({ background: value }, `${section.id}-background`)} reset={s.background ? () => onSettings({ background: undefined }) : undefined}
    />
    {free && <>
      <ColorField
        label="Cor do texto" value={s.color ?? effectiveColor} disabled={!canWrite} error={errors[`${base}.color`]}
        help={s.color ? undefined : 'Sem escolha, o texto se ajusta ao fundo.'}
        onChange={(value) => onSettings({ color: value }, `${section.id}-color`)} reset={s.color ? () => onSettings({ color: undefined }) : undefined}
      />
      {lowContrast && <p className={styles.warn} role="status">Contraste de {ratio.toFixed(1)}:1 entre texto e fundo. O mínimo recomendado é 4,5:1: escolha cores mais distantes.</p>}
    </>}
    <div className={styles.field}>
      <label htmlFor={`pad-${section.id}`}>Espaçamento vertical <b>{s.padding !== undefined ? `${s.padding}px` : 'Padrão'}</b></label>
      <input id={`pad-${section.id}`} type="range" min={0} max={MAX_PADDING} step={8} value={s.padding ?? 0} disabled={!canWrite} onChange={(event) => onSettings({ padding: Number(event.target.value) }, `${section.id}-padding`)}/>
      {s.padding !== undefined && canWrite && <button type="button" className={styles.linkButton} onClick={() => onSettings({ padding: undefined })}>Usar o espaçamento padrão</button>}
    </div>
    <div className={styles.field}>
      <label htmlFor={`width-${section.id}`}>Largura</label>
      <select id={`width-${section.id}`} value={s.width ?? 'contained'} disabled={!canWrite} onChange={(event) => onSettings({ width: event.target.value === 'full' ? 'full' : undefined })}>
        <option value="contained">Conteúdo centralizado</option>
        <option value="full">Largura completa</option>
      </select>
    </div>
  </div>
}

type PageInspectorProps = {
  kind: 'home' | 'page'
  slug: string | null
  meta: PageMeta
  canWrite: boolean
  published: boolean
  errors: Record<string, string>
  onMeta: (patch: PageMeta) => void
  onUnpublish: () => void
  onDelete: () => void
}

/** Ajustes da página como um todo: título e descrição nos buscadores, endereço e situação. */
export function PageInspector({ kind, slug, meta, canWrite, published, errors, onMeta, onUnpublish, onDelete }: PageInspectorProps) {
  if (kind === 'home') {
    return <div className={styles.inspectorBody}>
      <header className={styles.inspectorHead}><span className={styles.overline}>Página</span><h2>Página inicial</h2></header>
    </div>
  }
  return <div className={styles.inspectorBody}>
    <header className={styles.inspectorHead}><span className={styles.overline}>Página</span><h2>Ajustes da página</h2></header>
    <TextInput label="Título (aba do navegador e buscadores)" value={meta.title ?? ''} maxLength={70} disabled={!canWrite} error={errors['page.title']} onChange={(title) => onMeta({ title })}/>
    <TextInput label="Descrição nos buscadores" value={meta.description ?? ''} multiline maxLength={160} disabled={!canWrite} help="Até 160 caracteres." onChange={(description) => onMeta({ description })}/>
    <div className={styles.field}>
      <span>Endereço</span>
      <code className={styles.code}>/paginas/{slug}</code>
      <small className={styles.help}>{published ? <>No ar: <Link href={`/paginas/${slug}`} target="_blank">abrir</Link></> : 'Fora do ar.'}</small>
    </div>
    {canWrite && <div className={styles.toolRow}>
      {published
        ? <button type="button" className="btn secondary" onClick={onUnpublish}><EyeOff aria-hidden="true"/> Tirar do ar</button>
        : <button type="button" className="btn secondary" onClick={onDelete}><Trash2 aria-hidden="true"/> Apagar página</button>}
    </div>}
    
  </div>
}
