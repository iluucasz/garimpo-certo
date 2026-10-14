'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, RotateCcw, Save } from 'lucide-react'
import { contrastWithWhite, rankingFactors, rankingPresets, settingDefinitions, type SettingField, type SettingKey } from '@/lib/admin/settings-defs'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { generateRecommendations, type ScoringWeights } from '@/lib/recommendation/engine'
import { useStoreData } from '@/components/store-data-provider'
import { useAdminAccess } from './admin-access'
import { ImageUpload } from './image-upload'
import styles from './resource.module.css'

type SettingResponse = { key: SettingKey; value: Record<string, unknown>; updatedAt: string | null; isDefault: boolean }
type Values = Record<string, unknown>

export function SettingsForm({ settingKey }: { settingKey: SettingKey }) {
  const definition = settingDefinitions[settingKey]
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes(definition.permission)
  const { data, error, mutate } = useSWR<SettingResponse>(`/api/v1/admin/settings/${settingKey}`, swrFetcher, { revalidateOnFocus: false })
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setValues(data.value) }, [data])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer) }, [toast])

  const dirty = useMemo(() => Boolean(data) && JSON.stringify(values) !== JSON.stringify(data!.value), [values, data])
  const set = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => { const { [key]: _removed, ...rest } = current; return rest })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setProblem('')
    setErrors({})
    try {
      await adminFetch(`/api/v1/admin/settings/${settingKey}`, { method: 'PUT', body: JSON.stringify(values) })
      await mutate()
      setToast('Configuração salva. O site já usa os novos valores.')
    } catch (reason) {
      if (reason instanceof AdminApiError && Object.keys(reason.fields).length) setErrors(reason.fields)
      setProblem(reason instanceof AdminApiError ? reason.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!window.confirm('Voltar esta configuração aos valores originais?')) return
    setSaving(true)
    setProblem('')
    try {
      await adminFetch(`/api/v1/admin/settings/${settingKey}`, { method: 'DELETE' })
      await mutate()
      setToast('Valores originais restaurados.')
    } catch (reason) {
      setProblem(reason instanceof AdminApiError ? reason.message : 'Não foi possível restaurar.')
    } finally {
      setSaving(false)
    }
  }

  const groups = definition.sections
    ? definition.sections.map((section) => ({ title: section.title, description: section.description, fields: section.keys.flatMap((key) => definition.fields.filter((field) => field.key === key)) }))
    : [{ title: 'Configurações', description: undefined as string | undefined, fields: definition.fields }]

  if (error) return <div className="panel"><p className={styles.error} role="alert">Não foi possível carregar a configuração.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  return <div className={styles.stack}>
    <div className={settingKey === 'ranking' ? styles.withPreview : undefined}>
      <form onSubmit={save} noValidate className={styles.settingsForm}>
        {settingKey !== 'ranking' && <p className={styles.lead}>{definition.description}</p>}
        {!canWrite && <p className={styles.note}>Seu papel só permite consultar esta configuração.</p>}
        {settingKey === 'ranking' && <RankingSimple values={values} fields={definition.fields} disabled={!canWrite} errors={errors} onChange={set} onPreset={(preset) => setValues((current) => ({ ...current, ...preset }))}/>}
        {settingKey !== 'ranking' && <div className={styles.sections}>
          {groups.map((group) => <section key={group.title} className={styles.sectionCard} aria-label={group.title}>
            {(definition.sections || groups.length > 1) && <header><h2>{group.title}</h2>{group.description && <p>{group.description}</p>}</header>}
            <div className={styles.sectionBody}>
              {group.fields.map((field) => <Control key={field.key} field={field} value={values[field.key]} error={errors[field.key]} disabled={!canWrite} onChange={(value) => set(field.key, value)}/>)}
            </div>
          </section>)}
        </div>}
        {problem && <p className={styles.error} role="alert">{problem}</p>}
        <div className={`${styles.saveBar} ${dirty ? styles.saveBarDirty : ''}`}>
          <span className={styles.saveStatus} role="status">{dirty ? 'Alterações ainda não salvas.' : data.isDefault ? 'Usando os valores originais do site.' : `Personalizado · salvo em ${dateTime(data.updatedAt)}`}</span>
          <span className={styles.saveActions}>
            <button className="btn secondary" type="button" onClick={reset} disabled={!canWrite || saving || data.isDefault}><RotateCcw aria-hidden="true"/> Restaurar padrão</button>
            {dirty && <button className="btn secondary" type="button" onClick={() => data && setValues(data.value)} disabled={saving}>Descartar</button>}
            <button className="btn primary" type="submit" disabled={!canWrite || saving || !dirty}><Save aria-hidden="true"/> {saving ? 'Salvando…' : 'Salvar'}</button>
          </span>
        </div>
      </form>
      {settingKey === 'ranking' && <RankingPreview values={values}/>}
    </div>
    {settingKey === 'theme' && <ThemePreview values={values}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function Control({ field, value, error, disabled, onChange }: { field: SettingField; value: unknown; error?: string; disabled: boolean; onChange: (value: unknown) => void }) {
  const id = `setting-${field.key}`
  const describedBy = [field.help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  const help = field.help && <small id={`${id}-help`} className={styles.help}>{field.help}</small>
  const err = error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>

  if (field.type === 'boolean') {
    return <div><label className={styles.checkRow} htmlFor={id}>
      <input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-describedby={describedBy}/>
      <span>{field.label}{field.help && <><br/><small className={styles.help}>{field.help}</small></>}</span>
    </label>{err}</div>
  }
  if (field.type === 'order') {
    const order = Array.isArray(value) ? value.map(String) : field.items.map((item) => item.id)
    const move = (index: number, delta: number) => {
      const target = index + delta
      if (target < 0 || target >= order.length) return
      const next = [...order]
      ;[next[index], next[target]] = [next[target], next[index]]
      onChange(next)
    }
    return <div className={styles.field}><span id={id}>{field.label}</span>
      <ol className={styles.orderList} aria-labelledby={id}>
        {order.map((itemId, index) => <li className={styles.pickerItem} key={itemId}>
          <span className={styles.position}>{index + 1}</span>
          <span>{field.items.find((item) => item.id === itemId)?.label ?? itemId}</span>
          <span className={styles.actions}>
            <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label="Subir"><ArrowUp aria-hidden="true" size={16}/></button>
            <button type="button" disabled={disabled || index === order.length - 1} onClick={() => move(index, 1)} aria-label="Descer"><ArrowDown aria-hidden="true" size={16}/></button>
          </span>
        </li>)}
      </ol>{help}</div>
  }
  if (field.type === 'number') {
    const number = Number(value ?? field.min)
    return <div className={styles.numberField}>
      <div className={styles.numberHead}><label htmlFor={id}>{field.label}</label><output htmlFor={id}>{number.toLocaleString('pt-BR')}{field.unit ? ` ${field.unit}` : ''}</output></div>
      <input id={id} type="range" min={field.min} max={field.max} step={field.step ?? 1} value={number} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} aria-describedby={describedBy}/>
      {help}{err}</div>
  }
  if (field.type === 'color') {
    const color = String(value ?? '#000000')
    const ratio = /^#[0-9a-f]{6}$/i.test(color) ? contrastWithWhite(color) : 0
    return <div className={styles.field}><label htmlFor={id}>{field.label}</label>
      <div className={styles.colorRow}>
        <input id={id} className={styles.swatch} type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}/>
        <input className="input" style={{ maxWidth: 140 }} aria-label={`${field.label} (código)`} value={color} disabled={disabled} onChange={(event) => onChange(event.target.value)} maxLength={7}/>
        <span className={`${styles.badge} ${ratio >= 4.5 ? styles.badgeOn : styles.badgeWarn}`}>Contraste {ratio ? ratio.toFixed(1) : '—'}:1</span>
      </div>{help}{err}</div>
  }
  if (field.type === 'select') {
    return <label className={styles.field} htmlFor={id}>{field.label}
      <select id={id} className="select" value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>{help}{err}</label>
  }
  if (field.type === 'checklist') {
    return <label className={styles.field} htmlFor={id}>{field.label}
      <textarea id={id} className={`textarea ${error ? styles.inputError : ''}`} rows={6} value={String(value ?? '')} placeholder="Título | Texto" disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}/>
      {help}{err}</label>
  }
  if (field.type === 'list') {
    const text = Array.isArray(value) ? value.join('\n') : String(value ?? '')
    return <label className={styles.field} htmlFor={id}>{field.label}
      <textarea id={id} className="textarea" rows={5} value={text} placeholder={field.placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value.split(/\r?\n/))} aria-describedby={describedBy}/>
      {help}{err}</label>
  }
  const textual = field as Extract<SettingField, { type: 'text' | 'textarea' | 'url' }>
  if (textual.type === 'url' && textual.upload) {
    return <div className={styles.field}>
      <label htmlFor={id}>{field.label}</label>
      <input id={id} className={`input ${error ? styles.inputError : ''}`} type="url" maxLength={textual.maxLength} placeholder={textual.placeholder ?? 'Cole um endereço ou envie um arquivo'} value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}/>
      <ImageUpload value={String(value ?? '')} disabled={disabled} onChange={onChange}/>
      {help}{err}
    </div>
  }
  return <label className={styles.field} htmlFor={id}>{field.label}
    {textual.type === 'textarea'
      ? <textarea id={id} className={`textarea ${error ? styles.inputError : ''}`} rows={3} maxLength={textual.maxLength} value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}/>
      : <input id={id} className={`input ${error ? styles.inputError : ''}`} type={textual.type === 'url' ? 'url' : 'text'} maxLength={textual.maxLength} placeholder={textual.placeholder} value={String(value ?? '')} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}/>}
    {help}{err}</label>
}

/** Prévia ao vivo: aplica os pesos digitados ao catálogo real e mostra o que o motor escolheria hoje. */
function RankingPreview({ values }: { values: Values }) {
  const { products, offers, metrics } = useStoreData()
  const weights = Object.fromEntries(rankingFactors.map(([key]) => [key, Number(values[key] ?? 0) / 100])) as ScoringWeights
  const exploration = Number(values.exploration ?? 12) / 100
  const snapshot = useMemo(
    () => generateRecommendations({ seed: 'previa-admin', limit: 8, explorationRate: exploration, weights }, { products, offers, metrics }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(weights), exploration, products, offers, metrics],
  )
  return <section className="panel" aria-labelledby="preview-title">
    <h2 id="preview-title">Prévia com o catálogo de hoje</h2>
    <p className={styles.lead}>Os 8 primeiros produtos que o ranking escolheria com estes pesos, antes de salvar.</p>
    {snapshot.recommendations.length === 0 ? <p className={styles.help}>O catálogo está vazio.</p> : <ol className={styles.preview}>
      {snapshot.recommendations.map((item, index) => <li key={item.product.id}>
        <span className={styles.position}>{index + 1}</span>
        <span>{item.product.name}</span>
        <span className={styles.score}>{(item.score * 100).toFixed(0)} pts{item.explored ? ' · exploração' : ''}</span>
      </li>)}
    </ol>}
  </section>
}

function ThemePreview({ values }: { values: Values }) {
  const color = /^#[0-9a-f]{6}$/i.test(String(values.primary)) ? String(values.primary) : '#c3441d'
  const radius = values.radius === 'compact' ? 4 : values.radius === 'round' ? 22 : 10
  return <section className="panel" aria-labelledby="theme-preview">
    <h2 id="theme-preview">Prévia</h2>
    {String(values.noticeText ?? '') && <p style={{ background: '#1c2434', color: '#e8ebf2', textAlign: 'center', padding: '7px 14px', fontSize: 13, borderRadius: 8 }}>{String(values.noticeText)} <span style={{ color: '#b9c0cf' }}>{String(values.noticeDetail ?? '')}</span></p>}
    <div className={styles.actionsRow}>
      <span className={styles.sample} style={{ background: color, borderRadius: radius }}>Comprar agora</span>
      <span className={styles.sample} style={{ background: '#fff', color, border: `1px solid ${color}`, borderRadius: radius }}>Ver detalhes</span>
    </div>
  </section>
}

/** Ranking simples: escolher um estilo; o ajuste fino (os pesos de cada fator) fica recolhido. */
function RankingSimple({ values, fields, disabled, errors, onChange, onPreset }: {
  values: Values; fields: SettingField[]; disabled: boolean; errors: Record<string, string>
  onChange: (key: string, value: unknown) => void; onPreset: (preset: Record<string, number>) => void
}) {
  const matches = (preset: Record<string, number>) => Object.entries(preset).every(([key, value]) => Number(values[key]) === value)
  const current = rankingPresets.find((preset) => matches(preset.values))
  return <div className={styles.sections} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
    <section className={styles.sectionCard} aria-label="Estilo do ranking">
      <header>
        <h2>Como ordenar os produtos recomendados</h2>
        <p>Escolha o estilo que combina com a sua loja. A prévia mostra, ao lado, o resultado com os produtos de hoje; nada muda no site até você salvar.</p>
      </header>
      <div className={styles.presets} role="radiogroup" aria-label="Estilo do ranking">
        {rankingPresets.map((preset) => <button
          key={preset.id} type="button" role="radio" aria-checked={current?.id === preset.id} disabled={disabled}
          className={`${styles.preset} ${current?.id === preset.id ? styles.presetOn : ''}`} onClick={() => onPreset(preset.values)}
        >
          <strong>{preset.title}</strong>
          <span>{preset.description}</span>
        </button>)}
      </div>
      {!current && <p className={styles.help}>Os pesos estão <strong>personalizados</strong> (ajuste fino abaixo). Escolher um estilo acima substitui esses valores.</p>}
    </section>
    <details className={styles.fineTune}>
      <summary>Ajuste fino <small>(avançado: o peso de cada fator)</small></summary>
      <p className={styles.help}>Os pesos são proporcionais: só a relação entre eles importa. Mexer aqui deixa o estilo como “personalizado”.</p>
      <div className={styles.fineGrid}>
        {fields.map((field) => <Control key={field.key} field={field} value={values[field.key]} error={errors[field.key]} disabled={disabled} onChange={(value) => onChange(field.key, value)}/>)}
      </div>
    </details>
  </div>
}
