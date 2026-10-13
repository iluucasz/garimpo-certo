'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, History, Monitor, Plus, Rocket, Smartphone, Trash2, Undo2, ExternalLink } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import {
  MAX_ITEMS, MAX_SECTIONS, missingBuiltins, newId, newSection, sectionTypeList, sectionTypes,
  type Section, type SectionField, type SectionItem, type SectionSettings, type SectionType, type SiteDocument,
} from '@/lib/site-builder/document'
import type { EditorState } from '@/lib/db/repositories/site-documents'
import { useAdminAccess } from './admin-access'
import { ImageUpload } from './image-upload'
import styles from './site-builder.module.css'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const freeBlocks = sectionTypeList.filter((type) => !sectionTypes[type].builtin)

/** Editor visual da home: lista de seções, formulário da seção escolhida e prévia do rascunho real. */
export function SiteBuilder({ pageKey = 'home' }: { pageKey?: 'home' }) {
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes('content:write')
  const endpoint = `/api/v1/admin/site-documents/${pageKey}`
  const { data, error, mutate } = useSWR<EditorState>(endpoint, swrFetcher, { revalidateOnFocus: false })

  const [doc, setDoc] = useState<SiteDocument | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>('saved')
  const [problem, setProblem] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [previewKey, setPreviewKey] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const timer = useRef<number | null>(null)
  const latest = useRef<SiteDocument | null>(null)

  useEffect(() => {
    if (data && !doc) { setDoc(data.document); setSelected(data.document.sections[0]?.id ?? null) }
  }, [data, doc])

  const persist = useCallback(async (next: SiteDocument) => {
    setSave('saving')
    try {
      await adminFetch<EditorState>(endpoint, { method: 'PUT', body: JSON.stringify({ document: next }) })
      setFieldErrors({})
      setProblem('')
      setSave(latest.current === next ? 'saved' : 'dirty')
      setPreviewKey((value) => value + 1)
      void mutate()
    } catch (reason) {
      setSave('error')
      if (reason instanceof AdminApiError) { setProblem(reason.message); setFieldErrors(reason.fields) } else setProblem('Não foi possível salvar o rascunho.')
    }
  }, [endpoint, mutate])

  /** Toda edição passa por aqui: atualiza a tela na hora e salva o rascunho depois de uma pausa. */
  const change = useCallback((next: SiteDocument) => {
    setDoc(next)
    latest.current = next
    setSave('dirty')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void persist(next) }, 900)
  }, [persist])

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const current = useMemo(() => doc?.sections.find((section) => section.id === selected) ?? null, [doc, selected])

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar o editor.</p></div>
  if (!data || !doc) return <div className="panel" role="status">Carregando editor…</div>

  const sections = doc.sections
  const setSections = (next: Section[]) => change({ ...doc, sections: next })
  const update = (id: string, patch: Partial<Section>) => setSections(sections.map((section) => section.id === id ? { ...section, ...patch } : section))
  const updateSettings = (id: string, patch: Partial<SectionSettings>) => setSections(sections.map((section) => section.id === id ? { ...section, settings: { ...section.settings, ...patch } } : section))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSections(next)
  }
  const add = (type: SectionType) => {
    if (sections.length >= MAX_SECTIONS) { setProblem(`No máximo ${MAX_SECTIONS} seções.`); return }
    const section = sectionTypes[type].builtin
      ? { id: type, type, name: sectionTypes[type].label, hidden: false, settings: {} as SectionSettings }
      : newSection(type)
    setSections([...sections, section])
    setSelected(section.id)
  }
  const duplicate = (section: Section) => {
    const copy: Section = { ...section, id: newId(), name: `${section.name} (cópia)`, settings: JSON.parse(JSON.stringify(section.settings)) as SectionSettings }
    const index = sections.findIndex((item) => item.id === section.id)
    setSections([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)])
    setSelected(copy.id)
  }
  const remove = (section: Section) => {
    if (!window.confirm(`Remover "${section.name}" da página?`)) return
    const next = sections.filter((item) => item.id !== section.id)
    setSections(next)
    setSelected(next[0]?.id ?? null)
  }

  async function action(name: 'publish' | 'discard' | 'restore', versionId?: string) {
    if (timer.current) { window.clearTimeout(timer.current); await persist(latest.current ?? doc!) }
    if (name === 'publish' && !window.confirm('Publicar esta versão? A home do site passa a ser esta, na hora.')) return
    if (name === 'discard' && !window.confirm('Descartar o rascunho e voltar ao que está publicado?')) return
    setBusy(true)
    setProblem('')
    try {
      const state = await adminFetch<EditorState>(endpoint, { method: 'POST', body: JSON.stringify({ action: name, versionId }) })
      setDoc(state.document)
      latest.current = state.document
      setSelected((prev) => state.document.sections.some((section) => section.id === prev) ? prev : state.document.sections[0]?.id ?? null)
      setSave('saved')
      setPreviewKey((value) => value + 1)
      setShowHistory(false)
      setNotice(name === 'publish' ? 'Publicado. A home já mostra esta versão.' : name === 'discard' ? 'Rascunho descartado.' : 'Versão trazida para o rascunho. Confira e publique.')
      await mutate(state, { revalidate: false })
    } catch (reason) {
      setProblem(reason instanceof AdminApiError ? reason.message : 'Não foi possível concluir.')
    } finally {
      setBusy(false)
    }
  }

  const missing = missingBuiltins(doc)
  const hasChanges = data.hasDraft || save === 'dirty' || save === 'saving'
  const saveLabel = save === 'saving' ? 'Salvando…' : save === 'dirty' ? 'Alterações a salvar…' : save === 'error' ? 'Não salvo' : data.hasDraft ? `Rascunho salvo ${data.draftUpdatedAt ? `em ${dateTime(data.draftUpdatedAt)}` : ''}` : data.isDefault ? 'Versão original do site' : `Publicado ${data.publishedAt ? `em ${dateTime(data.publishedAt)}` : ''}`

  return <div className={styles.builder}>
    <header className={styles.toolbar}>
      <div className={styles.status} role="status" aria-live="polite">
        <strong>{hasChanges ? 'Rascunho' : 'Publicado'}</strong>
        <span className={save === 'error' ? styles.bad : undefined}>{saveLabel}</span>
      </div>
      <div className={styles.toolbarActions}>
        <div className={styles.segment} role="group" aria-label="Tamanho da prévia">
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor aria-hidden="true"/> Computador</button>
          <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone aria-hidden="true"/> Celular</button>
        </div>
        <a className="btn secondary" href="/?preview=1" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/> Abrir prévia</a>
        <button type="button" className="btn secondary" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}><History aria-hidden="true"/> Versões</button>
        {canWrite && <>
          <button type="button" className="btn secondary" disabled={busy || !data.hasDraft} onClick={() => action('discard')}><Undo2 aria-hidden="true"/> Descartar</button>
          <button type="button" className="btn primary" disabled={busy || (!hasChanges && !data.isDefault)} onClick={() => action('publish')}><Rocket aria-hidden="true"/> Publicar</button>
        </>}
      </div>
    </header>

    {problem && <p className={styles.problem} role="alert">{problem}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!canWrite && <p className={styles.notice} role="note">Seu papel só permite consultar a página.</p>}

    {showHistory && <section className={`panel ${styles.history}`} aria-label="Versões publicadas">
      <h2>Versões publicadas</h2>
      {data.history.length === 0
        ? <p>Ainda não há versões antigas. Cada publicação guarda a anterior aqui (até 15).</p>
        : <ul>{data.history.map((entry) => <li key={entry.id}>
          <span>{dateTime(entry.at)} · {entry.sections} seções</span>
          {canWrite && <button type="button" className="btn secondary" disabled={busy} onClick={() => action('restore', entry.id)}>Trazer para o rascunho</button>}
        </li>)}</ul>}
    </section>}

    <div className={styles.workspace}>
      <aside className={`panel ${styles.sections}`} aria-label="Seções da página">
        <h2>Seções</h2>
        <ol>
          {sections.map((section, index) => <li key={section.id} className={section.id === selected ? styles.current : undefined}>
            <button type="button" className={styles.pick} onClick={() => setSelected(section.id)} aria-current={section.id === selected ? 'true' : undefined}>
              <span className={`${styles.name} ${section.hidden ? styles.muted : ''}`}>{section.name}</span>
              <small>{sectionTypes[section.type].label}{section.hidden ? ' · oculta' : ''}</small>
            </button>
            {canWrite && <span className={styles.rowActions}>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${section.name}`}><ArrowUp aria-hidden="true"/></button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === sections.length - 1} aria-label={`Descer ${section.name}`}><ArrowDown aria-hidden="true"/></button>
              <button type="button" onClick={() => update(section.id, { hidden: !section.hidden })} aria-label={section.hidden ? `Mostrar ${section.name}` : `Ocultar ${section.name}`}>{section.hidden ? <EyeOff aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button>
            </span>}
          </li>)}
        </ol>
        {canWrite && <div className={styles.add}>
          <label>Adicionar seção
            <select value="" onChange={(event) => { if (event.target.value) add(event.target.value as SectionType) }}>
              <option value="">Escolha…</option>
              <optgroup label="Blocos livres">{freeBlocks.map((type) => <option key={type} value={type}>{sectionTypes[type].label}</option>)}</optgroup>
              {missing.length > 0 && <optgroup label="Seções do site">{missing.map((type) => <option key={type} value={type}>{sectionTypes[type].label}</option>)}</optgroup>}
            </select>
          </label>
        </div>}
      </aside>

      <section className={styles.preview} aria-label="Prévia da página">
        <div className={`${styles.frameWrap} ${device === 'mobile' ? styles.mobile : ''}`}>
          <iframe key={previewKey} title="Prévia da home com o rascunho" src={`/?preview=1&v=${previewKey}`} loading="lazy"/>
        </div>
        <p className={styles.hint}>A prévia usa o catálogo e as campanhas de hoje e se atualiza depois de cada salvamento automático.</p>
      </section>

      <aside className={`panel ${styles.inspector}`} aria-label="Ajustes da seção">
        {current
          ? <Inspector key={current.id} section={current} canWrite={canWrite} errors={fieldErrors} pathBase={`sections.${sections.findIndex((item) => item.id === current.id)}.settings`}
            onRename={(name) => update(current.id, { name })} onSettings={(patch) => updateSettings(current.id, patch)}
            onDuplicate={() => duplicate(current)} onRemove={() => remove(current)}/>
          : <p>Escolha uma seção para ajustar.</p>}
      </aside>
    </div>
  </div>
}

function Inspector({ section, canWrite, errors, pathBase, onRename, onSettings, onDuplicate, onRemove }: {
  section: Section; canWrite: boolean; errors: Record<string, string>; pathBase: string
  onRename: (name: string) => void; onSettings: (patch: Partial<SectionSettings>) => void; onDuplicate: () => void; onRemove: () => void
}) {
  const definition = sectionTypes[section.type]
  return <div>
    <h2>{definition.label}</h2>
    <p className={styles.help}>{definition.description}</p>
    <label className={styles.field}>Nome na lista
      <input value={section.name} maxLength={80} disabled={!canWrite} onChange={(event) => onRename(event.target.value)}/>
    </label>
    {definition.fields.length === 0 && <p className={styles.help}>Esta seção não tem ajustes de texto: o conteúdo vem do catálogo.</p>}
    {definition.fields.map((field) => <FieldControl key={field.key} field={field} settings={section.settings} disabled={!canWrite} errors={errors} path={`${pathBase}.${field.key}`} onChange={onSettings}/>)}
    {canWrite && <div className={styles.inspectorActions}>
      {!definition.builtin && <button type="button" className="btn secondary" onClick={onDuplicate}><Copy aria-hidden="true"/> Duplicar</button>}
      <button type="button" className="btn secondary" onClick={onRemove}><Trash2 aria-hidden="true"/> Remover</button>
    </div>}
  </div>
}

function FieldControl({ field, settings, disabled, errors, path, onChange }: {
  field: SectionField; settings: SectionSettings; disabled: boolean; errors: Record<string, string>; path: string; onChange: (patch: Partial<SectionSettings>) => void
}) {
  const id = `sb-${field.key}`
  const error = errors[path]
  const value = settings[field.key]
  const text = typeof value === 'string' ? value : ''
  const set = (next: unknown) => onChange({ [field.key]: next } as Partial<SectionSettings>)
  const help = field.help && <small className={styles.help}>{field.help}</small>
  const err = error && <small className={styles.bad} role="alert">{error}</small>

  if (field.kind === 'select') {
    return <label className={styles.field}>{field.label}
      <select value={text || field.options?.[0]?.value} disabled={disabled} onChange={(event) => set(event.target.value)}>
        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>{help}{err}</label>
  }
  if (field.kind === 'number') {
    return <label className={styles.field}>{field.label}
      <input type="number" min={field.min} max={field.max} value={typeof value === 'number' ? value : field.min ?? 0} disabled={disabled} onChange={(event) => set(Number(event.target.value))}/>
      {help}{err}</label>
  }
  if (field.kind === 'items') return <ItemsEditor items={settings.items ?? []} disabled={disabled} errors={errors} path={path} onChange={(items) => set(items)}/>
  if (field.kind === 'image') {
    return <div className={styles.field}><label htmlFor={id}>{field.label}</label>
      <input id={id} type="url" value={text} disabled={disabled} placeholder="Cole um endereço ou envie um arquivo" onChange={(event) => set(event.target.value)}/>
      <ImageUpload value={text} disabled={disabled} onChange={set}/>{help}{err}</div>
  }
  if (field.kind === 'textarea' || field.kind === 'markdown') {
    return <label className={styles.field}>{field.label}
      <textarea rows={field.kind === 'markdown' ? 10 : 3} maxLength={field.maxLength} value={text} disabled={disabled} onChange={(event) => set(event.target.value)}/>
      {help}{err}</label>
  }
  return <label className={styles.field}>{field.label}
    <input type={field.kind === 'url' ? 'url' : 'text'} maxLength={field.maxLength} value={text} disabled={disabled} onChange={(event) => set(event.target.value)}/>
    {help}{err}</label>
}

function ItemsEditor({ items, disabled, errors, path, onChange }: { items: SectionItem[]; disabled: boolean; errors: Record<string, string>; path: string; onChange: (items: SectionItem[]) => void }) {
  const patch = (index: number, change: Partial<SectionItem>) => onChange(items.map((item, position) => position === index ? { ...item, ...change } : item))
  const swap = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return <fieldset className={styles.items}>
    <legend>Cartões ({items.length}/{MAX_ITEMS})</legend>
    {items.map((item, index) => <div className={styles.item} key={item.id}>
      <div className={styles.itemHead}>
        <strong>Cartão {index + 1}</strong>
        {!disabled && <span className={styles.rowActions}>
          <button type="button" onClick={() => swap(index, -1)} disabled={index === 0} aria-label={`Subir cartão ${index + 1}`}><ArrowUp aria-hidden="true"/></button>
          <button type="button" onClick={() => swap(index, 1)} disabled={index === items.length - 1} aria-label={`Descer cartão ${index + 1}`}><ArrowDown aria-hidden="true"/></button>
          <button type="button" onClick={() => onChange(items.filter((_, position) => position !== index))} aria-label={`Remover cartão ${index + 1}`}><Trash2 aria-hidden="true"/></button>
        </span>}
      </div>
      <label className={styles.field}>Título<input value={item.title} maxLength={90} disabled={disabled} onChange={(event) => patch(index, { title: event.target.value })}/></label>
      <label className={styles.field}>Texto<textarea rows={2} maxLength={300} value={item.text} disabled={disabled} onChange={(event) => patch(index, { text: event.target.value })}/></label>
      <label className={styles.field}>Link<input type="url" value={item.href} disabled={disabled} placeholder="/colecoes ou https://…" onChange={(event) => patch(index, { href: event.target.value })}/>
        {errors[`${path}.${index}.href`] && <small className={styles.bad} role="alert">{errors[`${path}.${index}.href`]}</small>}</label>
      <div className={styles.field}><span>Imagem</span>
        <input type="url" value={item.image} disabled={disabled} placeholder="Endereço da imagem" onChange={(event) => patch(index, { image: event.target.value })}/>
        <ImageUpload value={item.image} disabled={disabled} onChange={(url) => patch(index, { image: url })}/>
        {errors[`${path}.${index}.image`] && <small className={styles.bad} role="alert">{errors[`${path}.${index}.image`]}</small>}</div>
    </div>)}
    {!disabled && items.length < MAX_ITEMS && <button type="button" className="btn secondary" onClick={() => onChange([...items, { id: newId(), title: '', text: '', image: '', href: '' }])}><Plus aria-hidden="true"/> Adicionar cartão</button>}
  </fieldset>
}
