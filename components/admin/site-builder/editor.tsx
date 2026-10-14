'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  ArchiveRestore, ArrowDown, ArrowUp, ExternalLink, EyeOff, FilePlus2, GripVertical, History as HistoryIcon, Monitor,
  Redo2, Rocket, Smartphone, Trash2, Undo2, Undo,
} from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import type { EditorState, PageSummary } from '@/lib/db/repositories/site-documents'
import { defaultDesign, type SiteDesign } from '@/lib/site-builder/design'
import {
  GLOBAL_KEY, MAX_SECTIONS, sectionTypes, slugify, type PageMeta, type SectionType, type SiteDocument,
} from '@/lib/site-builder/document'
import {
  createHistory, canRedo, canUndo, pushChange, redo as redoHistory, undo as undoHistory, type History,
} from '@/lib/site-builder/history'
import {
  archiveSection, createSection, deleteSection, duplicateSection, findSection, insertSection, moveBy, moveSection,
  neighbourAfterRemoval, restoreSection, sameDocument, updateSection, updateSettings,
} from '@/lib/site-builder/operations'
import { useAdminAccess } from '../admin-access'
import { designAreas, DesignInspector, type DesignArea } from './design-inspector'
import type { CollectionOption } from './fields'
import { PageInspector, SectionInspector } from './inspector'
import { Library, NEW_SECTION_MIME } from './library'
import { Preview, type GlobalArea, type Zoom } from './preview'
import styles from './site-builder.module.css'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
type Index = { pages: PageSummary[]; collections: CollectionOption[] }
type LeftPanel = 'sections' | 'add' | 'archived'

const SECTION_MIME = 'application/x-garimpo-section'
const PAGE_ITEM = '@page'
const recoveryKeyFor = (key: string) => `garimpo:cms-recovery:${key}`

/**
 * Editor visual do site: páginas (home e as criadas no painel) e a "Aparência do site" (tema, aviso do topo e
 * rodapé). Cada uma é um documento com rascunho, publicação e histórico próprios; esta casca só escolhe qual
 * documento está aberto e guarda o tamanho e o zoom da prévia entre uma e outra.
 */
export function SiteBuilder({ pageKey = 'home' }: { pageKey?: 'home' }) {
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes('content:write')
  const [key, setKey] = useState<string>(pageKey)
  const [designArea, setDesignArea] = useState<DesignArea>('theme')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [zoom, setZoom] = useState<Zoom>('fit')
  const flush = useRef<(() => Promise<void>) | null>(null)
  const { data: index, mutate: mutateIndex } = useSWR<Index>('/api/v1/admin/site-documents', swrFetcher, { revalidateOnFocus: false })

  const navigate = useCallback(async (next: string, area?: DesignArea) => {
    // O que está pendente de salvamento vai antes de trocar de documento.
    await flush.current?.()
    if (area) setDesignArea(area)
    setKey(next)
  }, [])

  return <Workspace
    key={key}
    docKey={key}
    canWrite={canWrite}
    pages={index?.pages ?? []}
    collections={index?.collections ?? []}
    device={device} onDevice={setDevice}
    zoom={zoom} onZoom={setZoom}
    designArea={designArea} onDesignArea={setDesignArea}
    onNavigate={navigate}
    onPagesChanged={() => mutateIndex()}
    flushRef={flush}
  />
}

type WorkspaceProps = {
  docKey: string
  canWrite: boolean
  pages: PageSummary[]
  collections: CollectionOption[]
  device: 'desktop' | 'mobile'; onDevice: (value: 'desktop' | 'mobile') => void
  zoom: Zoom; onZoom: (value: Zoom) => void
  designArea: DesignArea; onDesignArea: (value: DesignArea) => void
  onNavigate: (key: string, area?: DesignArea) => Promise<void>
  onPagesChanged: () => unknown
  flushRef: { current: (() => Promise<void>) | null }
}

function Workspace({ docKey, canWrite, pages, collections, device, onDevice, zoom, onZoom, designArea, onDesignArea, onNavigate, onPagesChanged, flushRef }: WorkspaceProps) {
  const endpoint = `/api/v1/admin/site-documents/${docKey}`
  const { data, error, mutate } = useSWR<EditorState>(endpoint, swrFetcher, { revalidateOnFocus: false })

  const [history, setHistory] = useState<History<SiteDocument> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState<LeftPanel>('sections')
  const [save, setSave] = useState<SaveState>('saved')
  const [problem, setProblem] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [token, setToken] = useState(0)
  const [recovery, setRecovery] = useState<SiteDocument | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragType, setDragType] = useState<SectionType | null>(null)
  // `undefined` = sem indicador; `null` = no fim da lista; texto = antes da seção com esse id.
  const [dropBefore, setDropBefore] = useState<string | null | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [createError, setCreateError] = useState('')

  const savedRef = useRef<SiteDocument | null>(null)
  const presentRef = useRef<SiteDocument | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const timer = useRef<number | null>(null)
  const recoveryKey = recoveryKeyFor(docKey)
  // O pai passa funções novas a cada render; por referência, o salvamento automático não reinicia a espera.
  const pagesChanged = useRef(onPagesChanged)
  useEffect(() => { pagesChanged.current = onPagesChanged })

  const doc = history?.present ?? null
  const kind = data?.kind ?? 'home'
  const isGlobal = kind === 'global'

  // ---- recuperação local (separada do rascunho salvo e do publicado)
  const writeRecovery = useCallback((value: SiteDocument) => {
    try { window.localStorage.setItem(recoveryKey, JSON.stringify({ at: Date.now(), document: value })) } catch { /* sem armazenamento: o salvamento automático segue valendo */ }
  }, [recoveryKey])
  const clearRecovery = useCallback(() => {
    try { window.localStorage.removeItem(recoveryKey) } catch { /* idem */ }
  }, [recoveryKey])

  // ---- carga inicial
  useEffect(() => {
    if (!data || history) return
    setHistory(createHistory(data.document))
    savedRef.current = data.document
    presentRef.current = data.document
    setSelected(data.kind === 'global' ? null : data.document.sections.find((section) => !section.archived)?.id ?? null)
    try {
      const raw = window.localStorage.getItem(recoveryKey)
      if (raw) {
        const stored = (JSON.parse(raw) as { document?: SiteDocument } | null)?.document
        if (stored && Array.isArray(stored.sections) && !sameDocument(stored, data.document)) setRecovery(stored)
        else window.localStorage.removeItem(recoveryKey)
      }
    } catch { /* recuperação corrompida: ignora */ }
  }, [data, history, recoveryKey])

  // ---- salvamento automático (fila: um PUT por vez, na ordem)
  const persist = useCallback((next: SiteDocument) => {
    const run = queue.current.then(async () => {
      setSave('saving')
      try {
        const state = await adminFetch<EditorState>(endpoint, { method: 'PUT', body: JSON.stringify({ document: next }) })
        savedRef.current = next
        setFieldErrors({})
        setProblem('')
        const current = sameDocument(presentRef.current, next)
        setSave(current ? 'saved' : 'dirty')
        if (current) clearRecovery()
        setToken((value) => value + 1)
        await mutate(state, { revalidate: false })
        void pagesChanged.current()
      } catch (reason) {
        setSave('error')
        if (reason instanceof AdminApiError) { setProblem(reason.message); setFieldErrors(reason.fields) } else setProblem('Não foi possível salvar o rascunho.')
      }
    })
    queue.current = run
    return run
  }, [endpoint, mutate, clearRecovery])

  useEffect(() => {
    presentRef.current = doc
    if (!doc || !canWrite) return
    if (sameDocument(doc, savedRef.current)) { setSave('saved'); clearRecovery(); return }
    setSave('dirty')
    writeRecovery(doc)
    const id = window.setTimeout(() => { timer.current = null; void persist(doc) }, 900)
    timer.current = id
    return () => { window.clearTimeout(id); if (timer.current === id) timer.current = null }
  }, [doc, canWrite, persist, writeRecovery, clearRecovery])

  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null }
    const current = presentRef.current
    if (current && canWrite && !sameDocument(current, savedRef.current)) await persist(current)
    else await queue.current
  }, [canWrite, persist])
  useEffect(() => { flushRef.current = flush; return () => { flushRef.current = null } }, [flush, flushRef])

  // ---- saída da página com alterações não salvas
  useEffect(() => {
    if (save === 'saved') return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [save])

  // ---- edição
  const change = useCallback((fn: (current: SiteDocument) => SiteDocument | null, group = '') => {
    setHistory((current) => {
      if (!current) return current
      const next = fn(current.present)
      return next ? pushChange(current, next, group) : current
    })
  }, [])

  const undo = useCallback(() => setHistory((current) => current ? undoHistory(current) : current), [])
  const redo = useCallback(() => setHistory((current) => current ? redoHistory(current) : current), [])

  // A seleção nunca aponta para uma seção que sumiu (desfazer, arquivar, restaurar versão).
  useEffect(() => {
    if (!doc || isGlobal || selected === PAGE_ITEM || selected === null) return
    const section = findSection(doc, selected)
    if (!section || section.archived) setSelected(doc.sections.find((item) => !item.archived)?.id ?? null)
  }, [doc, selected, isGlobal])

  const shortcut = useCallback((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return
    const keyName = event.key.toLowerCase()
    if (keyName === 'z' && !event.shiftKey) { event.preventDefault(); undo() }
    else if ((keyName === 'z' && event.shiftKey) || keyName === 'y') { event.preventDefault(); redo() }
    else if (keyName === 's') { event.preventDefault(); void flush() }
  }, [undo, redo, flush])
  useEffect(() => {
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [shortcut])

  const nextActiveAfter = (document: SiteDocument, id: string | null): string | null => {
    if (!id || id === PAGE_ITEM) return null
    const from = document.sections.findIndex((section) => section.id === id)
    if (from < 0) return null
    return document.sections.slice(from + 1).find((section) => !section.archived)?.id ?? null
  }

  function add(type: SectionType, beforeId?: string | null) {
    const current = presentRef.current
    if (!current) return
    const section = createSection(current, type)
    if (!section) { setProblem(`A seção “${sectionTypes[type].label}” já está nesta página.`); return }
    const next = insertSection(current, section, beforeId === undefined ? nextActiveAfter(current, selected) : beforeId)
    if (!next) { setProblem(`No máximo ${MAX_SECTIONS} seções (arquivadas contam).`); return }
    setProblem('')
    change(() => next)
    setSelected(section.id)
    setPanel('sections')
  }

  function restore(id: string) {
    change((current) => restoreSection(current, id))
    setSelected(id)
    setPanel('sections')
  }

  function archive(id: string) {
    const current = presentRef.current
    if (!current) return
    const after = neighbourAfterRemoval(current, id)
    change((value) => archiveSection(value, id))
    setSelected(after)
  }

  function duplicate(id: string) {
    const current = presentRef.current
    const result = current ? duplicateSection(current, id) : null
    if (!result) { setProblem(`No máximo ${MAX_SECTIONS} seções (arquivadas contam).`); return }
    change(() => result.document)
    setSelected(result.copy.id)
  }

  function dropOn(beforeId: string | null, event: React.DragEvent) {
    event.preventDefault()
    const movingId = event.dataTransfer.getData(SECTION_MIME) || dragId
    const type = (event.dataTransfer.getData(NEW_SECTION_MIME) || dragType) as SectionType | null
    setDropBefore(undefined)
    setDragId(null)
    setDragType(null)
    if (movingId) change((current) => moveSection(current, movingId, beforeId))
    else if (type && type in sectionTypes) add(type, beforeId)
  }

  /** Onde soltar, calculado do próprio evento (não do estado, que pode estar um passo atrás): metade de cima = antes da linha; metade de baixo = antes da próxima. */
  function dropTarget(event: React.DragEvent): string | null {
    const row = (event.target as HTMLElement).closest<HTMLElement>('li[data-section-id]')
    if (!row) return dropBefore === undefined ? null : dropBefore
    const rect = row.getBoundingClientRect()
    const id = row.dataset.sectionId ?? null
    const next = row.dataset.nextId || null
    return event.clientY > rect.top + rect.height / 2 ? next : id
  }

  /** Posição de soltar: metade de cima do item = antes dele; metade de baixo = antes do próximo (ou no fim). */
  function overRow(event: React.DragEvent, id: string, nextId: string | null) {
    if (!dragId && !dragType) return
    event.preventDefault()
    event.dataTransfer.dropEffect = dragId ? 'move' : 'copy'
    const rect = event.currentTarget.getBoundingClientRect()
    setDropBefore(event.clientY > rect.top + rect.height / 2 ? nextId : id)
  }

  async function action(name: 'publish' | 'discard' | 'restore' | 'unpublish', versionId?: string) {
    await flush()
    const what = isGlobal ? 'A aparência (tema, aviso e rodapé) passa a valer em todo o site, na hora.' : kind === 'page' ? 'A página passa a abrir para os visitantes, na hora.' : 'A home do site passa a ser esta, na hora.'
    if (name === 'publish' && !window.confirm(`Publicar esta versão? ${what}`)) return
    if (name === 'discard' && !window.confirm('Descartar o rascunho e voltar ao que está publicado?')) return
    if (name === 'unpublish' && !window.confirm('Tirar a página do ar? O conteúdo continua aqui como rascunho.')) return
    setBusy(true)
    setProblem('')
    try {
      const state = await adminFetch<EditorState>(endpoint, { method: 'POST', body: JSON.stringify({ action: name, versionId }) })
      if (name === 'discard' || name === 'restore') {
        // Entra no histórico: dá para desfazer, e o salvamento automático não recria o rascunho descartado.
        savedRef.current = state.document
        change(() => state.document)
      } else {
        savedRef.current = presentRef.current
      }
      setSave('saved')
      setFieldErrors({})
      setToken((value) => value + 1)
      setShowVersions(false)
      clearRecovery()
      setNotice({
        publish: isGlobal ? 'Publicado. O tema, o aviso e o rodapé já valem em todo o site.' : kind === 'page' ? 'Publicado. A página já está no ar.' : 'Publicado. A home já mostra esta versão.',
        discard: 'Rascunho descartado.',
        restore: 'Versão trazida para o rascunho. Confira e publique.',
        unpublish: 'Página fora do ar. O conteúdo ficou como rascunho.',
      }[name])
      await mutate(state, { revalidate: false })
      void pagesChanged.current()
    } catch (reason) {
      setProblem(reason instanceof AdminApiError ? reason.message : 'Não foi possível concluir.')
    } finally {
      setBusy(false)
    }
  }

  async function removePage() {
    if (!data?.slug || !window.confirm('Apagar esta página? Não dá para desfazer.')) return
    try {
      await adminFetch(endpoint, { method: 'DELETE' })
      clearRecovery()
      await onPagesChanged()
      await onNavigate('home')
    } catch (reason) {
      setProblem(reason instanceof AdminApiError ? reason.message : 'Não foi possível apagar a página.')
    }
  }

  async function createNewPage() {
    const title = newTitle.trim()
    if (!title) { setCreateError('Dê um título à página.'); return }
    try {
      const page = await adminFetch<PageSummary>('/api/v1/admin/site-documents', { method: 'POST', body: JSON.stringify({ title }) })
      setCreating(false)
      setNewTitle('')
      setCreateError('')
      await onPagesChanged()
      await onNavigate(page.key)
    } catch (reason) {
      setCreateError(reason instanceof AdminApiError ? reason.message : 'Não foi possível criar a página.')
    }
  }

  const sections = doc?.sections ?? []
  const active = useMemo(() => sections.filter((section) => !section.archived), [sections])
  const archived = useMemo(() => sections.filter((section) => section.archived), [sections])
  const current = selected && selected !== PAGE_ITEM ? findSection(doc ?? { schemaVersion: 1, sections: [] }, selected) : null
  const slug = data?.slug ?? null
  const previewSrc = kind === 'page' && slug ? `/paginas/${slug}?preview=1` : '/?preview=1'

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar o editor.</p></div>
  if (!data || !doc) return <div className="panel" role="status">Carregando editor…</div>

  const hasChanges = data.hasDraft || save === 'dirty' || save === 'saving'
  const unpublishedPage = kind === 'page' && data.isDefault
  const saveLabel = save === 'saving' ? 'Salvando…'
    : save === 'dirty' ? 'Alterações a salvar…'
    : save === 'error' ? 'Não salvo'
    : data.hasDraft ? `Rascunho salvo${data.draftUpdatedAt ? ` em ${dateTime(data.draftUpdatedAt)}` : ''}`
    : unpublishedPage ? 'Ainda não publicada'
    : data.isDefault ? 'Versão original do site'
    : `Publicado${data.publishedAt ? ` em ${dateTime(data.publishedAt)}` : ''}`
  const statusWord = unpublishedPage ? 'Fora do ar' : hasChanges ? 'Rascunho' : 'Publicado'
  const full = sections.length >= MAX_SECTIONS
  const meta: PageMeta = doc.page ?? {}
  const design: SiteDesign = doc.design ?? defaultDesign()
  const sectionIndex = current ? doc.sections.findIndex((section) => section.id === current.id) : -1
  const pageItems = pages.filter((page) => page.key !== docKey)

  const onSelectSection = (id: string) => { if (!isGlobal) { setSelected(id); setPanel('sections') } }
  const onGlobalArea = (area: GlobalArea) => { void onNavigate(GLOBAL_KEY, area === 'header' ? 'header' : 'footer') }

  return <div className={styles.builder}>
    <header className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <label className={styles.pageSelect}>
          <span className="sr-only">Página em edição</span>
          <select value={docKey} onChange={(event) => { void onNavigate(event.target.value) }}>
            <optgroup label="Páginas do site"><option value="home">Página inicial</option></optgroup>
            {(pageItems.length > 0 || kind === 'page') && <optgroup label="Páginas criadas">
              {kind === 'page' && <option value={docKey}>{meta.title || slug} {data.isDefault ? '(fora do ar)' : ''}</option>}
              {pageItems.map((page) => <option key={page.key} value={page.key}>{page.title}{page.published ? '' : ' (fora do ar)'}</option>)}
            </optgroup>}
            <optgroup label="Todo o site"><option value={GLOBAL_KEY}>Aparência do site</option></optgroup>
          </select>
        </label>
        {canWrite && <button type="button" className="btn secondary" aria-expanded={creating} onClick={() => setCreating((value) => !value)}><FilePlus2 aria-hidden="true"/> Nova página</button>}
      </div>

      <div className={styles.toolbarGroup}>
        <button type="button" className={styles.iconToolbar} onClick={undo} disabled={!history || !canUndo(history) || !canWrite} aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)"><Undo aria-hidden="true"/></button>
        <button type="button" className={styles.iconToolbar} onClick={redo} disabled={!history || !canRedo(history) || !canWrite} aria-label="Refazer (Ctrl+Shift+Z)" title="Refazer (Ctrl+Shift+Z)"><Redo2 aria-hidden="true"/></button>
        <label className={styles.zoom}>
          <span className="sr-only">Zoom da prévia</span>
          <select value={String(zoom)} onChange={(event) => onZoom(event.target.value === 'fit' ? 'fit' : Number(event.target.value) as Zoom)}>
            <option value="fit">Ajustar à largura</option>
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
          </select>
        </label>
        <div className={styles.segment} role="group" aria-label="Tamanho da prévia">
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => onDevice('desktop')}><Monitor aria-hidden="true"/> Computador</button>
          <button type="button" aria-pressed={device === 'mobile'} onClick={() => onDevice('mobile')}><Smartphone aria-hidden="true"/> Celular</button>
        </div>
      </div>

      <div className={styles.toolbarGroup}>
        <div className={styles.status} role="status" aria-live="polite">
          <strong>{statusWord}</strong>
          <span className={save === 'error' ? styles.bad : undefined}>{saveLabel}</span>
        </div>
        <a className="btn secondary" href={previewSrc} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/> Abrir prévia</a>
        <button type="button" className="btn secondary" onClick={() => setShowVersions((value) => !value)} aria-expanded={showVersions}><HistoryIcon aria-hidden="true"/> Versões</button>
        {canWrite && <>
          <button type="button" className="btn secondary" disabled={busy || !data.hasDraft} onClick={() => action('discard')}><Undo2 aria-hidden="true"/> Descartar</button>
          <button type="button" className="btn primary" disabled={busy || (!hasChanges && !data.isDefault)} onClick={() => action('publish')}><Rocket aria-hidden="true"/> Publicar</button>
        </>}
      </div>
    </header>

    {creating && <form className={`panel ${styles.newPage}`} onSubmit={(event) => { event.preventDefault(); void createNewPage() }}>
      <label className={styles.field}>Título da nova página
        <input value={newTitle} maxLength={70} autoFocus placeholder="Ex.: Presentes para o Dia das Mães" onChange={(event) => { setNewTitle(event.target.value); setCreateError('') }}/>
      </label>
      <p className={styles.help}>Endereço: <code>/paginas/{slugify(newTitle) || '…'}</code>. A página nasce como rascunho, fora do ar.</p>
      {createError && <p className={styles.bad} role="alert">{createError}</p>}
      <div className={styles.toolRow}>
        <button type="submit" className="btn primary">Criar página</button>
        <button type="button" className="btn secondary" onClick={() => { setCreating(false); setCreateError('') }}>Cancelar</button>
      </div>
    </form>}

    {problem && <p className={styles.problem} role="alert">{problem}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!canWrite && <p className={styles.notice} role="note">Seu papel só permite consultar a página.</p>}
    {recovery && canWrite && <p className={styles.notice} role="status">
      Há alterações deste navegador que não chegaram ao rascunho salvo.{' '}
      <button type="button" className={styles.linkButton} onClick={() => { change(() => recovery); setRecovery(null) }}>Recuperar</button>{' · '}
      <button type="button" className={styles.linkButton} onClick={() => { clearRecovery(); setRecovery(null) }}>Descartar</button>
    </p>}

    {showVersions && <section className={`panel ${styles.history}`} aria-label="Versões publicadas">
      <h2>Versões publicadas</h2>
      {data.history.length === 0
        ? <p>Ainda não há versões antigas. Cada publicação guarda a anterior aqui (até 30).</p>
        : <ul>{data.history.map((entry) => <li key={entry.id}>
          <span>{dateTime(entry.at)}{isGlobal ? '' : ` · ${entry.sections} seções`}</span>
          {canWrite && <button type="button" className="btn secondary" disabled={busy} onClick={() => action('restore', entry.id)}>Trazer para o rascunho</button>}
        </li>)}</ul>}
    </section>}

    <div className={styles.workspace}>
      <aside className={`panel ${styles.sections}`} aria-label={isGlobal ? 'Áreas da aparência' : 'Seções da página'}>
        {isGlobal
          ? <>
            <h2>Aparência do site</h2>
            <ol className={styles.areaList}>
              {designAreas.map((area) => <li key={area.id} className={area.id === designArea ? styles.current : undefined}>
                <button type="button" className={styles.pick} aria-current={area.id === designArea ? 'true' : undefined} onClick={() => onDesignArea(area.id)}>
                  <span className={styles.name}>{area.label}</span><small>{area.description}</small>
                </button>
              </li>)}
            </ol>
            <p className={styles.help}>Clique no aviso do topo ou no rodapé da prévia para abrir o ajuste.</p>
          </>
          : <>
            <div className={styles.tabs} role="tablist" aria-label="Painel de seções">
              <button type="button" role="tab" aria-selected={panel === 'sections'} onClick={() => setPanel('sections')}>Seções</button>
              <button type="button" role="tab" aria-selected={panel === 'add'} onClick={() => setPanel('add')}>Adicionar</button>
              <button type="button" role="tab" aria-selected={panel === 'archived'} onClick={() => setPanel('archived')}>Arquivadas{archived.length > 0 ? ` (${archived.length})` : ''}</button>
            </div>

            {panel === 'sections' && <>
              <ol
                className={styles.tree}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropBefore(undefined) }}
                onDragOver={(event) => { if (dragId || dragType) { event.preventDefault(); if ((event.target as HTMLElement) === event.currentTarget) setDropBefore(null) } }}
                onDrop={(event) => dropOn(dropTarget(event), event)}
              >
                <li className={selected === PAGE_ITEM ? styles.current : undefined}>
                  <button type="button" className={styles.pick} onClick={() => setSelected(PAGE_ITEM)} aria-current={selected === PAGE_ITEM ? 'true' : undefined}>
                    <span className={styles.name}>Ajustes da página</span>
                    <small>{kind === 'page' ? 'Título, descrição e endereço' : 'Busca e compartilhamento'}</small>
                  </button>
                </li>
                {active.map((section, position) => {
                  const nextId = active[position + 1]?.id ?? null
                  return <li
                    key={section.id}
                    data-section-id={section.id}
                    data-next-id={nextId ?? ''}
                    className={[section.id === selected ? styles.current : '', dropBefore === section.id ? styles.dropBefore : '', dragId === section.id ? styles.dragging : ''].filter(Boolean).join(' ')}
                    draggable={canWrite}
                    onDragStart={(event) => { event.dataTransfer.setData(SECTION_MIME, section.id); event.dataTransfer.effectAllowed = 'move'; setDragId(section.id) }}
                    onDragEnd={() => { setDragId(null); setDragType(null); setDropBefore(undefined) }}
                    onDragOver={(event) => overRow(event, section.id, nextId)}
                  >
                    {canWrite && <span className={styles.grip} aria-hidden="true"><GripVertical/></span>}
                    <button type="button" className={styles.pick} onClick={() => setSelected(section.id)} aria-current={section.id === selected ? 'true' : undefined}>
                      <span className={`${styles.name} ${section.hidden ? styles.muted : ''}`}>{section.name}</span>
                      <small>{sectionTypes[section.type].label}{section.hidden ? ' · oculta' : ''}</small>
                    </button>
                    {canWrite && <span className={styles.rowActions}>
                      <button type="button" onClick={() => change((value) => moveBy(value, section.id, -1))} disabled={position === 0} aria-label={`Subir ${section.name}`}><ArrowUp aria-hidden="true"/></button>
                      <button type="button" onClick={() => change((value) => moveBy(value, section.id, 1))} disabled={position === active.length - 1} aria-label={`Descer ${section.name}`}><ArrowDown aria-hidden="true"/></button>
                      <button type="button" onClick={() => change((value) => updateSection(value, section.id, { hidden: !section.hidden }))} aria-label={section.hidden ? `Mostrar ${section.name}` : `Ocultar ${section.name}`}><EyeOff aria-hidden="true"/></button>
                    </span>}
                  </li>
                })}
                {dropBefore === null && <li className={styles.dropEnd} aria-hidden="true"/>}
              </ol>
              {active.length === 0 && <p className={styles.help}>A página está vazia. Use a aba “Adicionar”.</p>}
              {canWrite && <p className={styles.help}>Arraste pelas alças para reordenar. Os botões ao lado também movem a seção.</p>}
            </>}

            {panel === 'add' && <Library
              document={doc} freeOnly={kind === 'page'} canWrite={canWrite} full={full}
              onAdd={(type) => add(type)} onRestore={restore} onDragType={setDragType}
            />}

            {panel === 'archived' && <>
              {archived.length === 0 && <p className={styles.help}>Nenhuma seção arquivada. Arquivar tira a seção da página sem apagar o que foi escrito.</p>}
              <ul className={styles.archiveList}>
                {archived.map((section) => <li key={section.id}>
                  <span><strong>{section.name}</strong><small>{sectionTypes[section.type].label}</small></span>
                  {canWrite && <span className={styles.rowActions}>
                    <button type="button" onClick={() => restore(section.id)} aria-label={`Restaurar ${section.name}`} title="Restaurar"><ArchiveRestore aria-hidden="true"/></button>
                    <button type="button" onClick={() => { if (window.confirm(`Apagar “${section.name}” de vez? Não dá para desfazer depois de salvar.`)) change((value) => deleteSection(value, section.id)) }} aria-label={`Apagar ${section.name} de vez`} title="Apagar de vez"><Trash2 aria-hidden="true"/></button>
                  </span>}
                </li>)}
              </ul>
            </>}
          </>}
      </aside>

      <section className={styles.preview} aria-label="Prévia da página">
        <Preview
          src={previewSrc} device={device} zoom={zoom} token={token}
          selectedId={isGlobal || selected === PAGE_ITEM ? null : selected}
          onSelect={onSelectSection} onGlobal={onGlobalArea} onShortcut={shortcut}
        />
        <p className={styles.hint}>A prévia é a página real, com o catálogo e as campanhas de hoje. Ela se atualiza depois de cada salvamento automático; clique numa seção para editá-la.</p>
      </section>

      <aside className={`panel ${styles.inspector}`} aria-label="Ajustes">
        {isGlobal
          ? <DesignInspector
            area={designArea} design={design} canWrite={canWrite} errors={fieldErrors}
            onChange={(fn, group) => change((value) => ({ ...value, design: fn(value.design ?? defaultDesign()) }), group)}
          />
          : selected === PAGE_ITEM
            ? <PageInspector
              kind={kind === 'page' ? 'page' : 'home'} slug={slug} meta={meta} canWrite={canWrite} published={!data.isDefault} errors={fieldErrors}
              onMeta={(patch) => change((value) => ({ ...value, page: { ...value.page, ...patch } }), 'page-meta')}
              onUnpublish={() => action('unpublish')} onDelete={() => void removePage()}
            />
            : current
              ? <SectionInspector
                key={current.id} section={current} index={sectionIndex} canWrite={canWrite} errors={fieldErrors} collections={collections}
                onName={(name) => change((value) => updateSection(value, current.id, { name }), `${current.id}-name`)}
                onSettings={(patch, group) => change((value) => updateSettings(value, current.id, patch), group ?? '')}
                onDuplicate={() => duplicate(current.id)}
                onToggleHidden={() => change((value) => updateSection(value, current.id, { hidden: !current.hidden }))}
                onArchive={() => archive(current.id)}
              />
              : <p className={styles.help}>Escolha uma seção na lista, ou clique nela na prévia, para ajustar.</p>}
      </aside>
    </div>
  </div>
}
