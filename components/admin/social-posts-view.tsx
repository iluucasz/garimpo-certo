'use client'

import { Fragment, useState } from 'react'
import useSWR from 'swr'
import { Check, Lightbulb, PlugZap, Play, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, fromLocalInput, swrFetcher, toLocalInput } from '@/lib/admin/client'
import { useAdminAccess } from './admin-access'
import { SettingsForm } from './settings-form'
import styles from './social-posts-view.module.css'

type Post = {
  id: string; status: 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled'; text: string; imageUrl: string | null; linkUrl: string
  campaign: string; source: string; facts: Record<string, unknown>; scheduledFor: string | null; sentAt: string | null; error: string | null; attempts: number; createdAt: string
}
type PostsData = {
  settings: { mode: 'off' | 'on'; dailyLimit: number; startHour: number; endHour: number; requireApproval: boolean; autoPlan: boolean; campaign: string }
  state: { at: string; planned: number; sent: number; failed: number; expired: number; note: string | null } | null
  configured: boolean
  aiAvailable: boolean
  posts: Post[]
}
type Option = { value: string; label: string }

const statusLabel: Record<Post['status'], string> = { pending: 'Aguardando aprovação', approved: 'Agendada', sent: 'Enviada', failed: 'Falhou', cancelled: 'Cancelada' }
type Tab = 'pending' | 'approved' | 'sent' | 'other'

/** Texto do Telegram (só <b> e <i>) como elementos React: nada de HTML solto na tela. */
function Preview({ text }: { text: string }) {
  const decode = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  let bold = false
  let italic = false
  return <div className={styles.preview}>{text.split(/(<\/?[bi]>)/).map((token, index) => {
    if (token === '<b>') { bold = true; return null }
    if (token === '</b>') { bold = false; return null }
    if (token === '<i>') { italic = true; return null }
    if (token === '</i>') { italic = false; return null }
    const lines = decode(token).split('\n')
    const content = lines.map((line, position) => <Fragment key={position}>{line}{position < lines.length - 1 && <br/>}</Fragment>)
    return bold ? <strong key={index}>{content}</strong> : italic ? <em key={index}>{content}</em> : <Fragment key={index}>{content}</Fragment>
  })}</div>
}

/** Fila de postagens do Telegram: o que vai ao canal, quando, e os botões para aprovar, editar ou cancelar. */
export function SocialPostsView() {
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes('catalog:write')
  const { data, error, mutate } = useSWR<PostsData>('/api/v1/admin/posts', swrFetcher, { revalidateOnFocus: false })
  const [search, setSearch] = useState('')
  const { data: products } = useSWR<Option[]>(search.trim().length >= 2 ? `/api/v1/admin/lookups/products?q=${encodeURIComponent(search.trim())}` : null, swrFetcher, { revalidateOnFocus: false })
  const [tab, setTab] = useState<Tab>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [productId, setProductId] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)

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

  const call = (body: unknown) => adminFetch<Record<string, unknown>>('/api/v1/admin/posts', { method: 'POST', body: JSON.stringify(body) })
  const patch = (id: string, body: unknown) => adminFetch<Record<string, unknown>>(`/api/v1/admin/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar as postagens.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  const groups: Record<Tab, Post[]> = {
    pending: data.posts.filter((post) => post.status === 'pending'),
    approved: data.posts.filter((post) => post.status === 'approved'),
    sent: data.posts.filter((post) => post.status === 'sent'),
    other: data.posts.filter((post) => post.status === 'failed' || post.status === 'cancelled'),
  }
  const list = groups[tab]
  const { settings } = data

  return <div className={styles.stack}>
    <section className="panel" aria-labelledby="posts-status">
      <div className={styles.head}>
        <div>
          <h2 id="posts-status">Canal do Telegram</h2>
          <p>
            <span className={`${styles.badge} ${data.configured ? styles.on : styles.off}`}>{data.configured ? 'Bot configurado' : 'Bot não configurado'}</span>{' '}
            <span className={`${styles.badge} ${settings.mode === 'on' ? styles.on : styles.off}`}>{settings.mode === 'on' ? 'Postagens ligadas' : 'Postagens desligadas'}</span>{' '}
            · {settings.dailyLimit} por dia, das {settings.startHour}h às {settings.endHour}h{settings.requireApproval ? ', com a sua aprovação' : ', sem aprovação'}
          </p>
        </div>
        {canWrite && <div className={styles.headActions}>
          <button type="button" className="btn secondary" disabled={busy === 'check' || !data.configured} onClick={() => act('check', () => call({ action: 'check' }), (result) => `Conectado: bot @${String(result.bot ?? '?')}, canal “${String(result.chatTitle ?? '?')}”${result.botStatus ? `, papel ${String(result.botStatus)}` : ''}.`)}><PlugZap aria-hidden="true"/> Conferir conexão</button>
          <button type="button" className="btn secondary" disabled={busy === 'plan'} onClick={() => act('plan', () => call({ action: 'plan' }), (result) => Number(result.created) ? `${String(result.created)} sugestões criadas para hoje.` : String(result.reason ?? 'Nada a criar.'))}><Lightbulb aria-hidden="true"/> Sugerir ofertas de hoje</button>
          <button type="button" className="btn primary" disabled={busy === 'run' || settings.mode === 'off'} onClick={() => act('run', () => call({ action: 'run' }), (result) => `Rodou: ${String(result.planned)} planejadas, ${String(result.sent)} enviadas, ${String(result.failed)} com falha.`)}><Play aria-hidden="true"/> Rodar agora</button>
        </div>}
      </div>
      {!data.configured && <p className={styles.note}>Para publicar, crie o bot no @BotFather, adicione-o como administrador do canal e defina <code>TELEGRAM_BOT_TOKEN</code> e <code>TELEGRAM_CHAT_ID</code> no ambiente (Vercel e VPS). Até lá, as postagens ficam na fila e você já vê e aprova o que iria ao ar.</p>}
      {data.state?.note && <p className={styles.note}>{data.state.note}</p>}
      {message && <p className={failed ? styles.bad : styles.ok} role={failed ? 'alert' : 'status'}>{message}</p>}
      {data.state && <p className={styles.help}>Última execução: {dateTime(data.state.at)}.</p>}
    </section>

    {canWrite && <section className="panel" aria-labelledby="posts-create">
      <h2 id="posts-create">Criar uma postagem</h2>
      <p className={styles.help}>Escolha um produto do catálogo. O texto é gerado com os números reais da oferta e o link leva a etiqueta <code>telegram-{settings.campaign}</code>.</p>
      <div className={styles.row}>
        <input type="search" aria-label="Buscar produto" placeholder="Digite parte do nome do produto" value={search} onChange={(event) => { setSearch(event.target.value); setProductId('') }}/>
        <select aria-label="Produto" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!products?.length}>
          <option value="">{search.trim().length < 2 ? 'Busque pelo nome primeiro' : products?.length ? 'Escolha um produto…' : 'Nenhum produto encontrado'}</option>
          {(products ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" className="btn primary" disabled={!productId || busy === 'create'} onClick={() => act('create', () => call({ action: 'create', productId }), () => { setProductId(''); setTab('pending'); return 'Postagem criada. Revise e aprove.' })}>Criar postagem</button>
      </div>
    </section>}

    <section className="panel" aria-labelledby="posts-queue">
      <h2 id="posts-queue">Fila</h2>
      <div className={styles.tabs} role="tablist" aria-label="Situação das postagens">
        {([['pending', `Aguardando (${groups.pending.length})`], ['approved', `Agendadas (${groups.approved.length})`], ['sent', `Enviadas (${groups.sent.length})`], ['other', `Falhas e canceladas (${groups.other.length})`]] as [Tab, string][]).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? styles.tabActive : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {list.length === 0 ? <p className={styles.help}>Nada aqui por enquanto.</p> : <ul className={styles.list}>{list.map((post) => {
        const open = post.status === 'pending' || post.status === 'approved'
        const text = drafts[post.id] ?? post.text
        return <li key={post.id} className={styles.item}>
          {post.imageUrl && <img className={styles.thumb} src={post.imageUrl} alt="" loading="lazy"/>}
          <div className={styles.body}>
            <div className={styles.meta}>
              <span className={`${styles.badge} ${post.status === 'sent' ? styles.on : post.status === 'failed' ? styles.bad2 : styles.off}`}>{statusLabel[post.status]}</span>
              <span>{post.source === 'engine' ? 'Sugerida pela Engine' : 'Criada à mão'}</span>
              {post.scheduledFor && <span>{post.status === 'sent' ? 'Horário' : 'Para'} {dateTime(post.scheduledFor)}</span>}
              {post.sentAt && <span>Enviada {dateTime(post.sentAt)}</span>}
              {(post.facts as { ai?: { rewritten?: boolean } }).ai?.rewritten && <span className={`${styles.badge} ${styles.off}`}>Texto por IA</span>}
            </div>
            {editing === post.id
              ? <textarea className={styles.editor} rows={7} value={text} onChange={(event) => setDrafts((current) => ({ ...current, [post.id]: event.target.value }))} aria-label="Texto da postagem"/>
              : <Preview text={post.text}/>}
            {post.error && <p className={styles.bad}>{post.error}</p>}
            {open && canWrite && <div className={styles.controls}>
              <label>Horário
                <input type="datetime-local" value={toLocalInput(post.scheduledFor)} onChange={(event) => { void patch(post.id, { scheduledFor: fromLocalInput(event.target.value) }).then(() => mutate()) }}/>
              </label>
              {editing === post.id
                ? <>
                  <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => act(post.id, async () => { await patch(post.id, { text }); setEditing(null); setDrafts((current) => { const { [post.id]: _gone, ...rest } = current; return rest }); return {} }, () => 'Texto salvo.')}>Salvar texto</button>
                  <button type="button" className="btn secondary" onClick={() => { setEditing(null); setDrafts((current) => { const { [post.id]: _gone, ...rest } = current; return rest }) }}>Descartar edição</button>
                </>
                : <button type="button" className="btn secondary" onClick={() => setEditing(post.id)}>Editar texto</button>}
              {data.aiAvailable && <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => act(post.id, () => patch(post.id, { action: 'rewrite' }), () => 'Texto reescrito pela IA. Confira antes de aprovar.')}><Sparkles aria-hidden="true"/> Reescrever com IA</button>}
              {(post.facts as { originalText?: string }).originalText && <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => act(post.id, () => patch(post.id, { action: 'restore_text' }), () => 'Texto original de volta.')}><RotateCcw aria-hidden="true"/> Texto original</button>}
              {post.status === 'pending' && <button type="button" className="btn primary" disabled={busy === post.id} onClick={() => act(post.id, () => patch(post.id, { action: 'approve' }), () => 'Aprovada: sai no horário marcado.')}><Check aria-hidden="true"/> Aprovar</button>}
              {data.configured && <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => { if (window.confirm('Enviar agora para o canal?')) void act(post.id, () => patch(post.id, { action: 'send' }), () => 'Enviada para o canal.') }}><Send aria-hidden="true"/> Enviar agora</button>}
              <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => act(post.id, () => patch(post.id, { action: 'cancel' }), () => 'Cancelada.')}><X aria-hidden="true"/> Cancelar</button>
            </div>}
            {post.status === 'failed' && canWrite && <div className={styles.controls}>
              <button type="button" className="btn secondary" disabled={busy === post.id} onClick={() => act(post.id, () => patch(post.id, { action: 'cancel' }), () => 'Removida da fila.')}>Remover da fila</button>
            </div>}
          </div>
        </li>
      })}</ul>}
    </section>

    <details className={styles.settings}>
      <summary>Ajustes das postagens</summary>
      <SettingsForm settingKey="social"/>
    </details>
  </div>
}
