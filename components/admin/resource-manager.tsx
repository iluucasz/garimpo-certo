'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { resources, segmentRuleTypes, type Option, type ResourceField, type ResourceSlug } from '@/lib/admin/resource-meta'
import { AdminApiError, adminFetch, dateTime, fromLocalInput, swrFetcher, toLocalInput } from '@/lib/admin/client'
import { slugify } from '@/lib/admin/validate'
import { useAdminAccess } from './admin-access'
import styles from './resource.module.css'

type Row = Record<string, unknown> & { id: string }
type ListResponse = { rows: Row[]; total: number; page: number; pageSize: number }
type Values = Record<string, unknown>

const hiddenInTable = new Set(['textarea', 'markdown', 'multi', 'products', 'rules', 'json'])
const userFacingError = (error: unknown) => (error instanceof AdminApiError ? error.message : 'Não foi possível concluir. Tente de novo.')

export function ResourceManager({ slug, toolbar, intro }: { slug: ResourceSlug; toolbar?: ReactNode; intro?: ReactNode }) {
  const meta = resources[slug]
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes(meta.write)
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirming, setConfirming] = useState<Row | null>(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(q); setPage(1) }, 250)
    return () => window.clearTimeout(timer)
  }, [q])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer) }, [toast])

  const pageSize = 25
  const key = `/api/v1/admin/resources/${slug}?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&page=${page}&pageSize=${pageSize}`
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(key, swrFetcher, { keepPreviousData: true, revalidateOnFocus: false })

  const columns = useMemo(() => meta.fields.filter((field) => !field.formOnly && !hiddenInTable.has(field.type)), [meta])
  const editable = meta.fields.some((field) => !field.readOnly && !field.listOnly && !field.createOnly)
  const rows = data?.rows ?? []
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))

  async function remove() {
    if (!confirming) return
    setBusy(true)
    setProblem('')
    try {
      await adminFetch(`/api/v1/admin/resources/${slug}/${encodeURIComponent(confirming.id)}`, { method: 'DELETE' })
      setConfirming(null)
      setToast(meta.remove === 'archive' ? 'Item ocultado da vitrine.' : 'Item excluído.')
      await mutate()
    } catch (reason) {
      setProblem(userFacingError(reason))
    } finally {
      setBusy(false)
    }
  }

  const title = (row: Row) => String(row[meta.fields[0].key] ?? row.id)
  const linkFor = (row: Row) => meta.publicPath?.replace('{slug}', String(row.slug ?? ''))

  return <div className="panel">
    {intro}
    <div className="admin-toolbar">
      {meta.searchPlaceholder && <div className="header-search"><Search aria-hidden="true"/><input value={q} onChange={(event) => setQ(event.target.value)} placeholder={meta.searchPlaceholder} aria-label={meta.searchPlaceholder}/></div>}
      <div className="toolbar-actions">
        {meta.filter && <label className="select-wrap"><span className="sr-only">{meta.filter.label}</span>
          <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}>
            <option value="">{meta.filter.label}: todos</option>
            {meta.filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>}
        {toolbar}
        {meta.create && <button className="btn primary" disabled={!canWrite} onClick={() => setCreating(true)} title={canWrite ? undefined : 'Seu papel não permite criar'}><Plus aria-hidden="true"/> {meta.createLabel}</button>}
      </div>
    </div>
    {!canWrite && meta.fields.some((field) => !field.readOnly) && <p className={styles.note}>Seu papel só permite consultar este módulo.</p>}
    {error && <p className={`${styles.note} ${styles.warn}`} role="alert">{userFacingError(error)}</p>}

    <div className="table-scroll">
      <table className="data-table" aria-label={meta.title}>
        <thead><tr>{columns.map((field) => <th scope="col" key={field.key}>{field.label}</th>)}<th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id}>
            {columns.map((field, index) => <td key={field.key}>{cell(field, row, index === 0 ? linkFor(row) : undefined)}</td>)}
            <td><div className="row-actions">
              {(editable && canWrite) || !editable ? <button aria-label={`${editable ? 'Editar' : 'Ver detalhes de'} ${title(row)}`} onClick={() => setEditing(row)}>{editable ? <Pencil aria-hidden="true"/> : <Search aria-hidden="true"/>}</button> : <button aria-label={`Ver ${title(row)}`} onClick={() => setEditing(row)}><Search aria-hidden="true"/></button>}
              {meta.remove && canWrite && <button aria-label={`${meta.remove === 'archive' ? 'Ocultar' : meta.slug === 'sessoes' ? 'Encerrar' : 'Excluir'} ${title(row)}`} onClick={() => { setProblem(''); setConfirming(row) }}><Trash2 aria-hidden="true"/></button>}
            </div></td>
          </tr>)}
          {!isLoading && rows.length === 0 && <tr><td colSpan={columns.length + 1}><div className="empty-state compact"><Search aria-hidden="true"/><h2>{query || filter ? 'Nada encontrado' : 'Nada por aqui ainda'}</h2><p>{query || filter ? 'Tente outros termos ou limpe os filtros.' : meta.emptyText}</p></div></td></tr>}
          {isLoading && rows.length === 0 && <tr><td colSpan={columns.length + 1}>Carregando…</td></tr>}
        </tbody>
      </table>
    </div>
    <div className={styles.pager}>
      <span>{data ? `${data.total.toLocaleString('pt-BR')} ${data.total === 1 ? meta.singular : 'registros'}` : ''}</span>
      {totalPages > 1 && <span className="toolbar-actions">
        <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
        <span>{page} de {totalPages}</span>
        <button className="btn secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Próxima</button>
      </span>}
    </div>

    {(creating || editing) && <RecordDrawer
      slug={slug}
      record={editing}
      readOnly={!canWrite || !editable}
      onClose={() => { setEditing(null); setCreating(false) }}
      onSaved={async (message) => { setEditing(null); setCreating(false); setToast(message); await mutate() }}
    />}

    {confirming && <div className="drawer-backdrop"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{meta.remove === 'archive' ? 'Ocultar da vitrine?' : meta.slug === 'sessoes' ? 'Encerrar esta sessão?' : 'Excluir?'}</h2>
      <p>{meta.remove === 'archive'
        ? `“${title(confirming)}” sai da vitrine, da busca e das coleções. O histórico de preço é mantido e a importação não o traz de volta.`
        : meta.slug === 'sessoes' ? `${title(confirming)} precisará entrar de novo.` : `“${title(confirming)}” será removido. Isso não pode ser desfeito.`}</p>
      {problem && <p className={styles.error} role="alert">{problem}</p>}
      <div className="drawer-actions"><button className="btn secondary" onClick={() => setConfirming(null)} disabled={busy}>Cancelar</button><button className="btn danger" onClick={remove} disabled={busy}>{busy ? 'Aguarde…' : meta.remove === 'archive' ? 'Ocultar' : meta.slug === 'sessoes' ? 'Encerrar' : 'Excluir'}</button></div>
    </div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function cell(field: ResourceField, row: Row, link?: string) {
  const value = row[field.key]
  if (value === null || value === undefined || value === '') return <span className={styles.badgeOff}>—</span>
  const content = (() => {
    switch (field.type) {
      case 'boolean': return <span className={`${styles.badge} ${value ? styles.badgeOn : styles.badgeOff}`}>{value ? 'Sim' : 'Não'}</span>
      case 'datetime': return dateTime(String(value))
      case 'select': return <span className={`${styles.badge} ${isPositive(value) ? styles.badgeOn : ''}`}>{field.options?.find((option) => option.value === value)?.label ?? String(value)}</span>
      case 'number': return Number(value).toLocaleString('pt-BR')
      case 'url': return <a href={String(value)} target="_blank" rel="noreferrer noopener" className={styles.clip}>{String(value).replace(/^https?:\/\//, '')}</a>
      default: return <span className={styles.clip} title={String(value)}>{String(value)}</span>
    }
  })()
  if (!link) return content
  return <span className={styles.cellTitle}><a href={link} target="_blank" rel="noreferrer noopener"><strong>{String(value)}</strong> <ExternalLink aria-hidden="true" size={13}/></a></span>
}
const isPositive = (value: unknown) => ['active', 'published', 'completed', 'succeeded'].includes(String(value))

// ---------------------------------------------------------------- formulário
function RecordDrawer({ slug, record, readOnly, onClose, onSaved }: { slug: ResourceSlug; record: Row | null; readOnly: boolean; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const meta = resources[slug]
  const creating = !record
  const [detail, setDetail] = useState<Row | null>(record)
  // Edição só libera o formulário depois de carregar o registro completo: salvar antes sobrescreveria com campos vazios.
  const [loaded, setLoaded] = useState(!record)
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState('')
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  // A lista traz só o resumo; o formulário busca o registro completo (categorias, texto, produtos...).
  useEffect(() => {
    if (!record) { setValues(defaults(meta.fields)); return }
    let cancelled = false
    adminFetch<Row>(`/api/v1/admin/resources/${slug}/${encodeURIComponent(record.id)}`)
      .then((full) => { if (!cancelled) { setDetail(full); setValues(full); setLoaded(true) } })
      .catch(() => { if (!cancelled) { setDetail(record); setValues(record); setLoaded(true) } })
    return () => { cancelled = true }
  }, [record, slug, meta.fields])

  const formFields = meta.fields.filter((field) => !field.listOnly && !(field.createOnly && !creating))
  const set = useCallback((key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value })), [])

  function onChange(field: ResourceField, value: unknown) {
    set(field.key, value)
    setErrors((current) => { const { [field.key]: _removed, ...rest } = current; return rest })
    if (field.key === 'slug') setSlugTouched(true)
    // O endereço acompanha o título enquanto ninguém o editou à mão.
    if (creating && !slugTouched && (field.key === 'title' || field.key === 'name' || field.key === 'label') && meta.fields.some((item) => item.key === 'slug' || item.key === 'code')) {
      const target = meta.fields.find((item) => item.key === 'slug' || item.key === 'code')!.key
      set(target, slugify(String(value)))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setProblem('')
    setErrors({})
    const payload: Values = {}
    for (const field of formFields) if (!field.readOnly) payload[field.key] = values[field.key]
    try {
      const url = creating ? `/api/v1/admin/resources/${slug}` : `/api/v1/admin/resources/${slug}/${encodeURIComponent(record!.id)}`
      await adminFetch(url, { method: creating ? 'POST' : 'PATCH', body: JSON.stringify(payload) })
      await onSaved(creating ? `${capitalize(meta.singular)} criado.` : 'Alterações salvas.')
    } catch (reason) {
      if (reason instanceof AdminApiError && Object.keys(reason.fields).length) setErrors(reason.fields)
      setProblem(userFacingError(reason))
    } finally {
      setSaving(false)
    }
  }

  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className={`admin-drawer ${styles.drawerWide}`} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header>
        <div><div className="kicker">{meta.title.toUpperCase()}</div><h2 id="drawer-title">{creating ? meta.createLabel : readOnly ? `Detalhes` : `Editar ${meta.singular}`}</h2></div>
        <button className="icon-btn static" onClick={onClose} aria-label="Fechar"><X aria-hidden="true"/></button>
      </header>
      {!loaded ? <p role="status" className={styles.help} style={{ marginTop: 24 }}>Carregando…</p> : <form className="form-stack" onSubmit={submit} noValidate>
        {formFields.map((field) => <FieldControl key={field.key} field={field} value={values[field.key]} error={errors[field.key]} disabled={readOnly || Boolean(field.readOnly)} onChange={(value) => onChange(field, value)} segment={slug === 'segmentos' ? { match: String(values.match ?? 'all') } : undefined}/>)}
        {slug === 'audit-log' && detail && <>
          <div className={styles.field}>Antes<pre className={styles.json}>{JSON.stringify(detail.before ?? null, null, 2)}</pre></div>
          <div className={styles.field}>Depois<pre className={styles.json}>{JSON.stringify(detail.after ?? null, null, 2)}</pre></div>
        </>}
        {problem && <p className={styles.error} role="alert">{problem}</p>}
        <div className="drawer-actions">
          <button type="button" className="btn secondary" onClick={onClose}>{readOnly ? 'Fechar' : 'Cancelar'}</button>
          {!readOnly && <button className="btn primary" type="submit" disabled={saving}><Save aria-hidden="true"/> {saving ? 'Salvando…' : 'Salvar'}</button>}
        </div>
      </form>}
    </aside>
  </div>
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function defaults(fields: ResourceField[]): Values {
  const values: Values = {}
  for (const field of fields) {
    if (field.type === 'boolean') values[field.key] = field.key === 'isActive' || field.key === 'enabled'
    else if (field.type === 'multi' || field.type === 'products') values[field.key] = []
    else if (field.type === 'rules') values[field.key] = { windowDays: 30, conditions: [] }
    else if (field.type === 'select') values[field.key] = field.options?.[0]?.value ?? ''
    else if (field.key === 'sortOrder') values[field.key] = 0
    else if (field.key === 'ctaLabel') values[field.key] = 'Ver agora'
    else if (field.key === 'tone') values[field.key] = 'Selecionados pela nossa equipe'
    else values[field.key] = ''
  }
  return values
}

function FieldControl({ field, value, error, disabled, onChange, segment }: { field: ResourceField; value: unknown; error?: string; disabled: boolean; onChange: (value: unknown) => void; segment?: { match: string } }) {
  const id = `field-${field.key}`
  const describedBy = [field.help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const help = field.help && <small id={`${id}-help`} className={styles.help}>{field.help}</small>
  const err = error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>

  if (field.type === 'boolean') {
    return <div><label className={styles.checkRow} htmlFor={id}>
      <input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-describedby={describedBy}/>
      <span>{field.label}{field.help && <><br/><small className={styles.help}>{field.help}</small></>}</span>
    </label>{err}</div>
  }
  if (disabled && !['multi', 'products', 'rules'].includes(field.type)) {
    return <div className={styles.field}>{field.label}<div className={styles.readonly}>{display(field, value)}</div></div>
  }
  if (field.type === 'multi') return <div className={styles.field}><span id={id}>{field.label}</span><MultiSelect lookup={field.lookup!} value={(value as string[]) ?? []} disabled={disabled} onChange={onChange} labelledBy={id}/>{help}{err}</div>
  if (field.type === 'products') return <div className={styles.field}><span id={id}>{field.label}</span><ProductPicker value={(value as string[]) ?? []} disabled={disabled} onChange={onChange}/>{help}{err}</div>
  if (field.type === 'rules') return <div className={styles.field}><span id={id}>{field.label}</span><RulesEditor value={value} disabled={disabled} onChange={onChange} match={segment?.match ?? 'all'}/>{help}{err}</div>

  const common = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, disabled, className: `${field.type === 'textarea' || field.type === 'markdown' ? 'textarea' : 'input'} ${error ? styles.inputError : ''}` }
  return <label className={styles.field} htmlFor={id}>
    <span>{field.label}{field.required && <span aria-hidden="true"> *</span>}</span>
    {field.type === 'select' && <select {...common} className={`select ${error ? styles.inputError : ''}`} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>{!field.required && <option value="">—</option>}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
    {(field.type === 'text' || field.type === 'url') && <input {...common} type={field.type === 'url' ? 'url' : 'text'} value={String(value ?? '')} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)}/>}
    {field.type === 'number' && <input {...common} type="number" inputMode="decimal" min={field.min} max={field.max} step="any" value={value === null || value === undefined ? '' : String(value)} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}/>}
    {field.type === 'datetime' && <input {...common} type="datetime-local" value={toLocalInput(value as string | null)} onChange={(event) => onChange(fromLocalInput(event.target.value))}/>}
    {(field.type === 'textarea' || field.type === 'markdown') && <textarea {...common} rows={field.type === 'markdown' ? 14 : 4} maxLength={field.maxLength} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} style={field.type === 'markdown' ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14 } : undefined}/>}
    {help}{err}
  </label>
}

function display(field: ResourceField, value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'datetime') return dateTime(String(value))
  if (field.type === 'select') return field.options?.find((option) => option.value === value)?.label ?? String(value)
  if (field.type === 'number') return Number(value).toLocaleString('pt-BR')
  return String(value)
}

// ---------------------------------------------------------------- seleção múltipla (categorias, selos, papéis)
function MultiSelect({ lookup, value, disabled, onChange, labelledBy }: { lookup: string; value: string[]; disabled: boolean; onChange: (value: string[]) => void; labelledBy: string }) {
  const { data, error } = useSWR<Option[]>(`/api/v1/admin/lookups/${lookup}`, swrFetcher, { revalidateOnFocus: false })
  if (error) return <p className={styles.error}>Não foi possível carregar as opções.</p>
  if (!data) return <p className={styles.help}>Carregando opções…</p>
  const selected = new Set(value)
  return <div className={styles.multi} role="group" aria-labelledby={labelledBy}>
    {data.map((option) => <label key={option.value}>
      <input type="checkbox" checked={selected.has(option.value)} disabled={disabled} onChange={(event) => onChange(event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value))}/>
      {option.label}
    </label>)}
  </div>
}

// ---------------------------------------------------------------- produtos em ordem (coleções)
type ProductOption = { value: string; label: string; slug: string; status: string }

function ProductPicker({ value, disabled, onChange }: { value: string[]; disabled: boolean; onChange: (value: string[]) => void }) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(term), 250); return () => window.clearTimeout(timer) }, [term])
  const { data: results } = useSWR<ProductOption[]>(debounced.length >= 2 || debounced === '' ? `/api/v1/admin/lookups/products?q=${encodeURIComponent(debounced)}` : null, swrFetcher, { revalidateOnFocus: false })
  const { data: chosen } = useSWR<ProductOption[]>(value.length ? `/api/v1/admin/lookups/products?ids=${value.join(',')}` : null, swrFetcher, { revalidateOnFocus: false })
  const labels = useMemo(() => new Map((chosen ?? []).map((item) => [item.value, item])), [chosen])
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return <div className={styles.picker}>
    <ol className={styles.pickerSelected} aria-label="Produtos escolhidos, em ordem">
      {value.map((id, index) => <li className={styles.pickerItem} key={id}>
        <span className={styles.position}>{index + 1}</span>
        <span>{labels.get(id)?.label ?? 'Carregando…'}{labels.get(id) && labels.get(id)!.status !== 'active' && <small className={styles.help}> · {labels.get(id)!.status === 'removed' ? 'oculto' : 'indisponível'}</small>}</span>
        {!disabled && <span className={styles.actions}>
          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir"><ArrowUp aria-hidden="true" size={16}/></button>
          <button type="button" onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label="Descer"><ArrowDown aria-hidden="true" size={16}/></button>
          <button type="button" onClick={() => onChange(value.filter((item) => item !== id))} aria-label="Remover"><X aria-hidden="true" size={16}/></button>
        </span>}
      </li>)}
      {value.length === 0 && <li className={styles.help}>Nenhum produto escolhido ainda.</li>}
    </ol>
    {!disabled && <>
      <input className="input" type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar produto para adicionar" aria-label="Buscar produto para adicionar"/>
      <ul className={styles.pickerResults}>
        {(results ?? []).filter((item) => !value.includes(item.value)).map((item) => <li className={styles.pickerItem} key={item.value}>
          <span>{item.label}</span>
          <button type="button" onClick={() => onChange([...value, item.value])} aria-label={`Adicionar ${item.label}`}><Plus aria-hidden="true" size={16}/></button>
        </li>)}
      </ul>
    </>}
  </div>
}

// ---------------------------------------------------------------- regras do segmento
type Condition = { type: string; value: string | number }
type Rules = { windowDays: number; conditions: Condition[] }

function RulesEditor({ value, disabled, onChange, match }: { value: unknown; disabled: boolean; onChange: (value: Rules) => void; match: string }) {
  const rules: Rules = value && typeof value === 'object' && !Array.isArray(value) && 'conditions' in value
    ? { windowDays: Number((value as Rules).windowDays) || 30, conditions: (value as Rules).conditions ?? [] }
    : { windowDays: 30, conditions: [] }
  const [reach, setReach] = useState<number | null>(null)
  const signature = JSON.stringify({ rules, match })
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      adminFetch<{ reach: number }>('/api/v1/admin/segments/preview', { method: 'POST', body: JSON.stringify({ match, rules }) })
        .then((result) => { if (!cancelled) setReach(result.reach) })
        .catch(() => { if (!cancelled) setReach(null) })
    }, 400)
    return () => { cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const update = (conditions: Condition[]) => onChange({ ...rules, conditions })
  return <div className={styles.rules}>
    <label className={styles.field}>Janela de tempo
      <select className="select" disabled={disabled} value={rules.windowDays} onChange={(event) => onChange({ ...rules, windowDays: Number(event.target.value) })}>
        {[7, 14, 30, 60, 90, 180].map((days) => <option key={days} value={days}>Últimos {days} dias</option>)}
      </select>
    </label>
    {rules.conditions.map((condition, index) => {
      const type = segmentRuleTypes.find((item) => item.value === condition.type) ?? segmentRuleTypes[0]
      return <div className={styles.rule} key={index}>
        <select className="select" aria-label="Tipo de regra" disabled={disabled} value={condition.type} onChange={(event) => update(rules.conditions.map((item, at) => (at === index ? { type: event.target.value, value: '' } : item)))}>
          {segmentRuleTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <input className="input" aria-label={type.help} placeholder={type.kind === 'number' ? (type.unit ?? '') : 'texto'} type={type.kind === 'number' ? 'number' : 'text'} min={0} disabled={disabled} value={String(condition.value)} onChange={(event) => update(rules.conditions.map((item, at) => (at === index ? { ...item, value: type.kind === 'number' ? Number(event.target.value) : event.target.value } : item)))}/>
        {!disabled && <button type="button" className="btn secondary" onClick={() => update(rules.conditions.filter((_, at) => at !== index))} aria-label="Remover regra"><Trash2 aria-hidden="true"/></button>}
      </div>
    })}
    {!disabled && rules.conditions.length < 8 && <button type="button" className="btn secondary" onClick={() => update([...rules.conditions, { type: 'min_clicks', value: 1 }])}><Plus aria-hidden="true"/> Adicionar regra</button>}
    <div className={styles.reach} aria-live="polite"><strong>{reach === null ? '—' : reach.toLocaleString('pt-BR')}</strong>sessões com clique de compra nesse recorte</div>
  </div>
}
