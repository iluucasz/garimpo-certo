'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Copy, Download, Lightbulb, Repeat2, X } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { formatPrice } from '@/lib/format'
import { channelLabel, type ContentChannel } from '@/lib/social/content'
import type { ContentItem } from '@/lib/social/content-view'
import { useAdminAccess } from './admin-access'
import { SettingsForm } from './settings-form'
import styles from './content-posts-view.module.css'

type ContentData = {
  settings: { instagramDaily: number; tiktokDaily: number; startHour: number; endHour: number; campaign: string; disclosure: boolean; autoPlan: boolean }
  today: { channel: ContentChannel; planned: number; created: number; published: number }[]
  items: ContentItem[]
}
type Option = { value: string; label: string }

const channels: ContentChannel[] = ['instagram', 'tiktok']
const statusLabel: Record<string, string> = { pending: 'A publicar', sent: 'Publicado', cancelled: 'Cancelado' }

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Posts diários de Instagram e TikTok. A Engine prepara o conteúdo (legenda, roteiro, hashtags, imagem e link com
 * etiqueta do canal); a publicação é feita à mão na rede e depois marcada aqui como publicada.
 */
export function ContentPostsView() {
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes('catalog:write')
  const { data, error, mutate } = useSWR<ContentData>('/api/v1/admin/content', swrFetcher, { revalidateOnFocus: false })
  const [channel, setChannel] = useState<ContentChannel>('instagram')
  const [search, setSearch] = useState('')
  const { data: products } = useSWR<Option[]>(search.trim().length >= 2 ? `/api/v1/admin/lookups/products?q=${encodeURIComponent(search.trim())}` : null, swrFetcher, { revalidateOnFocus: false })
  const [productId, setProductId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { text?: string; script?: string }>>({})

  async function act<T>(key: string, work: () => Promise<T>, success: (result: T) => string) {
    setBusy(key); setMessage(''); setFailed(false)
    try {
      const result = await work()
      setMessage(success(result))
      await mutate()
    } catch (reason) {
      setFailed(true); setMessage(reason instanceof AdminApiError ? reason.message : 'Não foi possível concluir.')
    } finally { setBusy(null) }
  }
  const post = (body: unknown) => adminFetch<Record<string, unknown>>('/api/v1/admin/content', { method: 'POST', body: JSON.stringify(body) })
  const patch = (id: string, body: unknown) => adminFetch<Record<string, unknown>>(`/api/v1/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  const flash = (text: string, bad = false) => { setMessage(text); setFailed(bad) }

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar o conteúdo.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  const mine = data.items.filter((item) => item.channel === channel)
  const toPublish = mine.filter((item) => item.status === 'pending')
  const published = mine.filter((item) => item.status === 'sent')
  const cancelled = mine.filter((item) => item.status === 'cancelled')
  const { settings } = data

  const draftOf = (item: ContentItem) => ({ text: drafts[item.id]?.text ?? item.text, script: drafts[item.id]?.script ?? item.script ?? '' })
  const dirty = (item: ContentItem) => drafts[item.id]?.text !== undefined && drafts[item.id]?.text !== item.text
    || drafts[item.id]?.script !== undefined && drafts[item.id]?.script !== (item.script ?? '')
  const clearDraft = (id: string) => setDrafts((current) => { const { [id]: _gone, ...rest } = current; return rest })

  async function doCopy(label: string, text: string) {
    flash((await copy(text)) ? `${label} copiada.` : 'Não foi possível copiar: selecione o texto e use Ctrl+C.', false)
  }

  const renderItem = (item: ContentItem) => {
    const open = item.status === 'pending'
    const draft = draftOf(item)
    return <li key={item.id} className={styles.item}>
      <a className={styles.cardLink} href={`/api/v1/admin/content/${item.id}/card?format=feed`} target="_blank" rel="noreferrer" aria-label="Abrir a imagem do post em tamanho cheio">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.card} src={`/api/v1/admin/content/${item.id}/card?format=feed`} alt={`Imagem do post: ${item.name}`} loading="lazy"/>
      </a>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={`${styles.badge} ${item.status === 'sent' ? styles.on : item.status === 'cancelled' ? styles.bad2 : styles.off}`}>{statusLabel[item.status] ?? item.status}</span>
          <span>{item.source === 'engine' ? 'Sugerido pela Engine' : 'Criado à mão'}</span>
          {item.scheduledFor && item.status === 'pending' && <span>Sugestão: {dateTime(item.scheduledFor)}</span>}
          {item.publishedAt && <span>Publicado {dateTime(item.publishedAt)}</span>}
        </div>
        <strong className={styles.name}>{item.name}{item.price !== null ? ` · ${formatPrice(item.price)}` : ''}</strong>

        <label className={styles.field}>
          <span>{item.channel === 'instagram' ? 'Legenda' : 'Legenda do vídeo'}</span>
          <textarea rows={item.channel === 'instagram' ? 9 : 5} value={draft.text} disabled={!open || !canWrite}
            onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], text: event.target.value } }))}/>
        </label>
        {item.channel === 'tiktok' && item.script !== null && <label className={styles.field}>
          <span>Roteiro</span>
          <textarea rows={9} value={draft.script} disabled={!open || !canWrite}
            onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], script: event.target.value } }))}/>
        </label>}

        <div className={styles.linkRow}>
          <input readOnly value={item.linkUrl} aria-label="Link de afiliado deste post" onFocus={(event) => event.currentTarget.select()}/>
          <button type="button" className="btn secondary" onClick={() => void doCopy('Link', item.linkUrl)}><Copy aria-hidden="true"/> Copiar link</button>
        </div>
        <p className={styles.help}>Coloque este link na bio (ou no adesivo de link do Story). Ele leva a etiqueta <code>{item.channel}-{item.campaign}</code>, e as vendas aparecem em Analytics por canal.</p>

        <div className={styles.controls}>
          <button type="button" className="btn secondary" onClick={() => void doCopy('Legenda', draft.text)}><Copy aria-hidden="true"/> Copiar legenda</button>
          {item.channel === 'tiktok' && item.script !== null && <button type="button" className="btn secondary" onClick={() => void doCopy('Roteiro', draft.script)}><Copy aria-hidden="true"/> Copiar roteiro</button>}
          <a className="btn secondary" href={`/api/v1/admin/content/${item.id}/card?format=feed`} download={`post-${item.channel}-feed.png`}><Download aria-hidden="true"/> Imagem do feed</a>
          <a className="btn secondary" href={`/api/v1/admin/content/${item.id}/card?format=story`} download={`post-${item.channel}-story.png`}><Download aria-hidden="true"/> Imagem de Story/vídeo</a>
        </div>

        {open && canWrite && <div className={styles.controls}>
          {dirty(item) && <button type="button" className="btn primary" disabled={busy === item.id}
            onClick={() => act(item.id, async () => { await patch(item.id, { text: draft.text, ...(item.channel === 'tiktok' ? { script: draft.script } : {}) }); clearDraft(item.id); return {} }, () => 'Alterações salvas.')}>Salvar alterações</button>}
          <button type="button" className="btn primary" disabled={busy === item.id}
            onClick={() => {
              const url = window.prompt('Endereço da publicação (opcional). Cole o link do post na rede, ou deixe em branco.', '')
              if (url === null) return
              void act(item.id, () => patch(item.id, { action: 'published', ...(url.trim() ? { url: url.trim() } : {}) }), () => 'Marcado como publicado.')
            }}><Check aria-hidden="true"/> Marcar como publicado</button>
          <button type="button" className="btn secondary" disabled={busy === item.id}
            onClick={() => act(item.id, () => patch(item.id, { action: 'replace' }), () => 'Produto trocado: o novo conteúdo está na lista.')}><Repeat2 aria-hidden="true"/> Trocar produto</button>
          <button type="button" className="btn secondary" disabled={busy === item.id}
            onClick={() => act(item.id, () => patch(item.id, { action: 'cancel' }), () => 'Cancelado.')}><X aria-hidden="true"/> Cancelar</button>
        </div>}
        {item.publishedUrl && <p className={styles.help}><a href={item.publishedUrl} target="_blank" rel="noreferrer">Ver a publicação</a></p>}
      </div>
    </li>
  }

  return <div className={styles.stack}>
    <section className="panel" aria-labelledby="content-today">
      <div className={styles.head}>
        <div>
          <h2 id="content-today">Posts de hoje</h2>
          <p>A Engine prepara o conteúdo; você publica na rede e marca aqui. Nada é publicado sozinho.</p>
        </div>
        {canWrite && <div className={styles.headActions}>
          <button type="button" className="btn primary" disabled={busy === 'plan'}
            onClick={() => act('plan', () => post({ action: 'plan' }), (result) => Number(result.created) ? `${String(result.created)} post(s) preparado(s) para hoje.` : `Nada a criar agora. ${((result.notes as string[] | undefined) ?? []).join(' ') || 'A cota de hoje já está completa.'}`)}>
            <Lightbulb aria-hidden="true"/> Preparar os posts de hoje</button>
        </div>}
      </div>
      <ul className={styles.today}>
        {data.today.map((row) => <li key={row.channel}>
          <strong>{channelLabel[row.channel]}</strong>
          <span>{row.planned === 0 ? 'desligado' : `${row.published} de ${row.planned} publicado${row.planned === 1 ? '' : 's'} hoje`}</span>
          {row.planned > 0 && row.created < row.planned && <small>faltam {row.planned - row.created} para preparar</small>}
        </li>)}
      </ul>
      {message && <p className={failed ? styles.bad : styles.ok} role={failed ? 'alert' : 'status'}>{message}</p>}
    </section>

    {canWrite && <section className="panel" aria-labelledby="content-create">
      <h2 id="content-create">Criar conteúdo de um produto</h2>
      <p className={styles.help}>Escolha a rede e um produto do catálogo. O texto é gerado com os números reais da oferta.</p>
      <div className={styles.row}>
        <select aria-label="Rede" value={channel} onChange={(event) => setChannel(event.target.value as ContentChannel)}>
          {channels.map((id) => <option key={id} value={id}>{channelLabel[id]}</option>)}
        </select>
        <input type="search" aria-label="Buscar produto" placeholder="Digite parte do nome do produto" value={search} onChange={(event) => { setSearch(event.target.value); setProductId('') }}/>
        <select aria-label="Produto" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!products?.length}>
          <option value="">{search.trim().length < 2 ? 'Busque pelo nome primeiro' : products?.length ? 'Escolha um produto…' : 'Nenhum produto encontrado'}</option>
          {(products ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" className="btn primary" disabled={!productId || busy === 'create'}
          onClick={() => act('create', () => post({ action: 'create', productId, channel }), () => { setProductId(''); return `Conteúdo de ${channelLabel[channel]} criado.` })}>Criar conteúdo</button>
      </div>
    </section>}

    <section className="panel" aria-labelledby="content-queue">
      <h2 id="content-queue">Fila</h2>
      <div className={styles.tabs} role="tablist" aria-label="Rede">
        {channels.map((id) => {
          const count = data.items.filter((item) => item.channel === id && item.status === 'pending').length
          return <button key={id} type="button" role="tab" aria-selected={channel === id} className={channel === id ? styles.tabActive : undefined} onClick={() => setChannel(id)}>
            {channelLabel[id]}{count ? ` (${count} a publicar)` : ''}
          </button>
        })}
      </div>
      {toPublish.length === 0
        ? <p className={styles.help}>Nada a publicar no {channelLabel[channel]} agora. Use “Preparar os posts de hoje” ou crie de um produto.</p>
        : <ul className={styles.list}>{toPublish.map(renderItem)}</ul>}

      {published.length > 0 && <details className={styles.collapse}>
        <summary>Publicados ({published.length})</summary>
        <ul className={styles.list}>{published.map(renderItem)}</ul>
      </details>}
      {cancelled.length > 0 && <details className={styles.collapse}>
        <summary>Cancelados ({cancelled.length})</summary>
        <ul className={styles.list}>{cancelled.map(renderItem)}</ul>
      </details>}
    </section>

    <details className={styles.settings}>
      <summary>Ajustes de Instagram e TikTok</summary>
      <SettingsForm settingKey="content"/>
    </details>
  </div>
}
