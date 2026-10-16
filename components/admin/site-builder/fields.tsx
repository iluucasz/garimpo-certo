'use client'

import { useEffect, useId, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { MAX_ITEMS, newId, type SectionField, type SectionItem, type SectionSettings } from '@/lib/site-builder/document'
import { ImageUpload } from '../image-upload'
import styles from './site-builder.module.css'

export type CollectionOption = { slug: string; title: string; group: string }

/** Seletor de cor com campo hexadecimal e, opcionalmente, "voltar ao padrão". */
export function ColorField({ label, value, onChange, reset, help, error, disabled }: {
  label: string; value: string; onChange: (value: string) => void; reset?: () => void; help?: string; error?: string; disabled?: boolean
}) {
  const [hex, setHex] = useState(value)
  useEffect(() => setHex(value), [value])
  const valid = /^#[0-9a-f]{6}$/i.test(value)
  return <div className={styles.field} title={help}>
    <span>{label}</span>
    <div className={styles.colorRow}>
      <input type="color" aria-label={label} value={valid ? value : '#ffffff'} disabled={disabled} onChange={(event) => onChange(event.target.value)}/>
      <input
        aria-label={`${label} (hexadecimal)`} value={hex} maxLength={7} spellCheck={false} disabled={disabled}
        onBlur={() => setHex(value)}
        onChange={(event) => { setHex(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value) }}
      />
      {reset && !disabled && <button type="button" className={styles.iconButton} aria-label={`Voltar ao padrão: ${label}`} onClick={reset}><X aria-hidden="true"/></button>}
    </div>
    {error && <small className={styles.bad} role="alert">{error}</small>}
  </div>
}

export function TextInput({ label, value, onChange, multiline, maxLength, help, error, disabled, placeholder, rows }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; help?: string; error?: string
  disabled?: boolean; placeholder?: string; rows?: number
}) {
  const id = useId()
  return <div className={styles.field} title={help}>
    <label htmlFor={id}>{label}</label>
    {multiline
      ? <textarea id={id} rows={rows ?? 3} maxLength={maxLength} value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)}/>
      : <input id={id} maxLength={maxLength} value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)}/>}
    {error && <small className={styles.bad} role="alert">{error}</small>}
  </div>
}

/** Controle de um campo da definição da seção (`sectionTypes[type].fields`). */
export function FieldControl({ field, settings, disabled, errors, path, collections, onChange }: {
  field: SectionField; settings: SectionSettings; disabled: boolean; errors: Record<string, string>; path: string
  collections: CollectionOption[]; onChange: (patch: Partial<SectionSettings>) => void
}) {
  const id = useId()
  const error = errors[path]
  const value = settings[field.key]
  const text = typeof value === 'string' ? value : ''
  const set = (next: unknown) => onChange({ [field.key]: next } as Partial<SectionSettings>)
  const help = null
  const err = error && <small className={styles.bad} role="alert">{error}</small>

  if (field.kind === 'select') {
    return <div className={styles.field} title={field.help}><label htmlFor={id}>{field.label}</label>
      <select id={id} value={text || field.options?.[0]?.value} disabled={disabled} onChange={(event) => set(event.target.value)}>
        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>{help}{err}</div>
  }
  if (field.kind === 'collection') {
    const known = collections.some((item) => item.slug === text)
    const groups = Array.from(new Set(collections.map((item) => item.group)))
    return <div className={styles.field} title={field.help}><label htmlFor={id}>{field.label}</label>
      <select id={id} value={text} disabled={disabled} onChange={(event) => set(event.target.value)}>
        {!text && <option value="">Escolha uma coleção…</option>}
        {text && !known && <option value={text}>{text} (não encontrada)</option>}
        {groups.map((group) => <optgroup key={group} label={group}>
          {collections.filter((item) => item.group === group).map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
        </optgroup>)}
      </select>
      {text && !known && <small className={styles.help}>Coleção não encontrada.</small>}{err}</div>
  }
  if (field.kind === 'number') {
    return <div className={styles.field} title={field.help}><label htmlFor={id}>{field.label} <b>{typeof value === 'number' ? value : field.min ?? 0}{field.unit ?? 'px'}</b></label>
      <input id={id} type="range" min={field.min} max={field.max} step={field.step ?? 8} value={typeof value === 'number' ? value : field.min ?? 0} disabled={disabled} onChange={(event) => set(Number(event.target.value))}/>
      {help}{err}</div>
  }
  if (field.kind === 'items') {
    return <ItemsEditor items={settings.items ?? []} variant={field.variant ?? 'cards'} textMax={field.maxLength ?? 300} disabled={disabled} errors={errors} path={path} onChange={(items) => set(items)}/>
  }
  if (field.kind === 'image') {
    return <div className={styles.field} title={field.help}><label htmlFor={id}>{field.label}</label>
      <input id={id} type="url" value={text} disabled={disabled} placeholder="Cole um endereço ou envie um arquivo" onChange={(event) => set(event.target.value)}/>
      <ImageUpload value={text} disabled={disabled} onChange={set}/>{help}{err}</div>
  }
  if (field.kind === 'textarea' || field.kind === 'markdown') {
    return <div className={styles.field} title={field.help}><label htmlFor={id}>{field.label}</label>
      <textarea id={id} rows={field.kind === 'markdown' ? 9 : 3} maxLength={field.maxLength} value={text} disabled={disabled} onChange={(event) => set(event.target.value)}/>
      {help}{err}</div>
  }
  return <div className={styles.field} title={field.help}><label htmlFor={id}>{field.label}</label>
    <input id={id} type={field.kind === 'url' ? 'url' : 'text'} maxLength={field.maxLength} value={text} disabled={disabled} onChange={(event) => set(event.target.value)}/>
    {help}{err}</div>
}

function ItemsEditor({ items, variant, textMax, disabled, errors, path, onChange }: {
  items: SectionItem[]; variant: 'cards' | 'faq'; textMax: number; disabled: boolean; errors: Record<string, string>; path: string; onChange: (items: SectionItem[]) => void
}) {
  const faq = variant === 'faq'
  const noun = faq ? 'pergunta' : 'cartão'
  const patch = (index: number, change: Partial<SectionItem>) => onChange(items.map((item, position) => position === index ? { ...item, ...change } : item))
  const swap = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return <fieldset className={styles.items}>
    <legend>{faq ? 'Perguntas' : 'Cartões'} ({items.length}/{MAX_ITEMS})</legend>
    {items.map((item, index) => <div className={styles.item} key={item.id}>
      <div className={styles.itemHead}>
        <strong>{faq ? 'Pergunta' : 'Cartão'} {index + 1}</strong>
        {!disabled && <span className={styles.rowActions}>
          <button type="button" onClick={() => swap(index, -1)} disabled={index === 0} aria-label={`Subir ${noun} ${index + 1}`}><ArrowUp aria-hidden="true"/></button>
          <button type="button" onClick={() => swap(index, 1)} disabled={index === items.length - 1} aria-label={`Descer ${noun} ${index + 1}`}><ArrowDown aria-hidden="true"/></button>
          <button type="button" onClick={() => onChange(items.filter((_, position) => position !== index))} aria-label={`Remover ${noun} ${index + 1}`}><Trash2 aria-hidden="true"/></button>
        </span>}
      </div>
      <TextInput label={faq ? 'Pergunta' : 'Título'} value={item.title} maxLength={faq ? 140 : 90} disabled={disabled} onChange={(title) => patch(index, { title })}/>
      <TextInput label={faq ? 'Resposta' : 'Texto'} value={item.text} multiline rows={faq ? 4 : 2} maxLength={textMax} disabled={disabled} onChange={(text) => patch(index, { text })}/>
      {!faq && <>
        <TextInput label="Link" value={item.href} placeholder="/colecoes ou https://…" disabled={disabled} error={errors[`${path}.${index}.href`]} onChange={(href) => patch(index, { href })}/>
        <div className={styles.field}><span>Imagem</span>
          <input type="url" value={item.image} disabled={disabled} placeholder="Endereço da imagem" aria-label={`Endereço da imagem do cartão ${index + 1}`} onChange={(event) => patch(index, { image: event.target.value })}/>
          <ImageUpload value={item.image} disabled={disabled} onChange={(url) => patch(index, { image: url })}/>
          {errors[`${path}.${index}.image`] && <small className={styles.bad} role="alert">{errors[`${path}.${index}.image`]}</small>}</div>
      </>}
    </div>)}
    {!disabled && items.length < MAX_ITEMS && <button type="button" className="btn secondary" onClick={() => onChange([...items, { id: newId(), title: '', text: '', image: '', href: '' }])}><Plus aria-hidden="true"/> Adicionar {noun}</button>}
  </fieldset>
}
