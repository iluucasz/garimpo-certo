'use client'

import { FormEvent, useState } from 'react'
import useSWR from 'swr'
import { FlaskConical, Play, Square, Trash2, Wand2 } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { MIN_PER_VARIANT, type Comparison, type VariantCopy, type VariantStats } from '@/lib/experiments/core'
import { useAdminAccess } from './admin-access'
import styles from './ab-tests-view.module.css'

type Experiment = {
  id: string; key: string; name: string; hypothesis: string | null; status: 'draft' | 'running' | 'stopped'; variantB: VariantCopy; splitB: number
  winner: 'a' | 'b' | null; startedAt: string | null; stoppedAt: string | null; createdAt: string
  results: { a: VariantStats; b: VariantStats; comparison: Comparison }
}

const statusLabel = { draft: 'Rascunho', running: 'Em andamento', stopped: 'Encerrado' } as const
const pct = (value: number) => `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const points = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`

function verdictText(comparison: Comparison) {
  switch (comparison.verdict) {
    case 'insufficient': return `Ainda sem dados suficientes: faltam ${comparison.missing.a} visitas na A e ${comparison.missing.b} na B para chegar a ${MIN_PER_VARIANT} em cada.`
    case 'b_better': return `A variante B converte mais, com diferença de ${points(comparison.diffPoints)} (intervalo de 95%: ${points(comparison.ciLow)} a ${points(comparison.ciHigh)}).`
    case 'a_better': return `A variante A (a atual) converte mais, com diferença de ${points(-comparison.diffPoints)} a favor dela.`
    default: return `Sem diferença clara entre as variantes (intervalo de 95%: ${points(comparison.ciLow)} a ${points(comparison.ciHigh)}). Manter a atual é seguro.`
  }
}

/** Testes A/B do texto do topo da home: criar, iniciar, acompanhar o resultado e aplicar o vencedor. */
export function AbTestsView() {
  const { permissions } = useAdminAccess()
  const canWrite = permissions.includes('content:write')
  const { data, error, mutate } = useSWR<{ experiments: Experiment[] }>('/api/v1/admin/experiments', swrFetcher, { revalidateOnFocus: false })
  const [form, setForm] = useState({ name: '', hypothesis: '', title: '', accent: '', text: '', buttonLabel: '', splitB: 50 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function act(key: string, work: () => Promise<unknown>, success: string) {
    setBusy(key); setMessage(''); setFailed(false)
    try { await work(); setMessage(success); await mutate() } catch (reason) {
      setFailed(true); setMessage(reason instanceof AdminApiError ? reason.message : 'Não foi possível concluir.')
    } finally { setBusy(null) }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setErrors({}); setMessage(''); setFailed(false); setBusy('create')
    try {
      await adminFetch('/api/v1/admin/experiments', { method: 'POST', body: JSON.stringify({
        name: form.name, hypothesis: form.hypothesis, splitB: form.splitB,
        variantB: { title: form.title, accent: form.accent, text: form.text, buttonLabel: form.buttonLabel },
      }) })
      setForm({ name: '', hypothesis: '', title: '', accent: '', text: '', buttonLabel: '', splitB: 50 })
      setMessage('Teste criado como rascunho. Inicie quando estiver pronto.')
      await mutate()
    } catch (reason) {
      setFailed(true)
      if (reason instanceof AdminApiError) { setErrors(reason.fields); setMessage(reason.message) } else setMessage('Não foi possível criar.')
    } finally { setBusy(null) }
  }

  const post = (id: string, body: unknown) => adminFetch(`/api/v1/admin/experiments/${id}`, { method: 'POST', body: JSON.stringify(body) })

  if (error) return <div className="panel"><p role="alert">Não foi possível carregar os testes.</p></div>
  if (!data) return <div className="panel" role="status">Carregando…</div>

  return <div className={styles.stack}>
    <section className="panel">
      <details>
        <summary><FlaskConical aria-hidden="true"/> Como funciona <small>(abrir)</small></summary>
      <ul className={styles.help}>
        <li>Metade dos visitantes (ou a parte que você escolher) vê o texto novo no topo da home; os outros veem o atual. Cada pessoa vê sempre a mesma versão.</li>
        <li>Só entra no teste quem permitiu a medição de uso. Sem a permissão a pessoa vê o texto atual e nada é guardado.</li>
        <li>O que se mede é a parte das visitas que clicou em um botão de compra. Não é venda: a Shopee não informa de qual visita veio o pedido.</li>
        <li>Espere pelo menos {MIN_PER_VARIANT} visitas em cada variante antes de decidir. Parar cedo porque “parece que ganhou” costuma enganar.</li>
      </ul>
      </details>
      {message && <p className={failed ? styles.bad : styles.ok} role={failed ? 'alert' : 'status'}>{message}</p>}
    </section>

    {canWrite && <form className="panel" onSubmit={create} noValidate>
      <h2>Novo teste</h2>
      <div className={styles.grid}>
        <label>Nome do teste<input value={form.name} maxLength={80} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Título mais direto" required/>{errors.name && <small className={styles.bad}>{errors.name}</small>}</label>
        <label>Hipótese (opcional)<input value={form.hypothesis} maxLength={300} onChange={(event) => setForm({ ...form, hypothesis: event.target.value })} placeholder="O que você espera que mude e por quê"/></label>
        <label>Título (linha 1) da B<input value={form.title} maxLength={40} onChange={(event) => setForm({ ...form, title: event.target.value })}/>{errors['variantB.title'] && <small className={styles.bad}>{errors['variantB.title']}</small>}</label>
        <label>Título (linha 2, destaque) da B<input value={form.accent} maxLength={40} onChange={(event) => setForm({ ...form, accent: event.target.value })}/></label>
        <label className={styles.wide}>Texto de apoio da B<textarea rows={2} value={form.text} maxLength={200} onChange={(event) => setForm({ ...form, text: event.target.value })}/></label>
        <label>Botão da B<input value={form.buttonLabel} maxLength={24} onChange={(event) => setForm({ ...form, buttonLabel: event.target.value })}/></label>
        <label>Visitantes na B: {form.splitB}%<input type="range" min={10} max={90} step={5} value={form.splitB} onChange={(event) => setForm({ ...form, splitB: Number(event.target.value) })}/>{errors.splitB && <small className={styles.bad}>{errors.splitB}</small>}</label>
      </div>
      <p className={styles.help}>Campos em branco ficam iguais à home atual. A variante A é sempre o texto que está no ar.</p>
      <button type="submit" className="btn primary" disabled={busy === 'create'}>Criar teste</button>
    </form>}

    <section className="panel">
      <h2>Testes</h2>
      {data.experiments.length === 0 ? <p className={styles.help}>Nenhum teste ainda.</p> : <ul className={styles.list}>{data.experiments.map(({ id, name, hypothesis, status, variantB, splitB, winner, startedAt, stoppedAt, results }) => <li key={id} className={styles.item}>
        <div className={styles.itemHead}>
          <div><strong>{name}</strong><span className={`${styles.badge} ${styles[`s_${status}`]}`}>{statusLabel[status]}</span></div>
          {canWrite && <div className={styles.actions}>
            {status === 'draft' && <button type="button" className="btn primary" disabled={busy === id} onClick={() => act(id, () => post(id, { action: 'start' }), 'Teste iniciado. A home já sorteia as variantes.')}><Play aria-hidden="true"/> Iniciar</button>}
            {status === 'running' && <button type="button" className="btn secondary" disabled={busy === id} onClick={() => { if (window.confirm('Encerrar o teste? Os visitantes voltam a ver só o texto atual.')) void act(id, () => post(id, { action: 'stop' }), 'Teste encerrado.') }}><Square aria-hidden="true"/> Encerrar</button>}
            {status !== 'draft' && <button type="button" className="btn secondary" disabled={busy === id} onClick={() => { if (window.confirm('Copiar os textos da variante B para o rascunho da home? Você confere e publica em Home.')) void act(id, () => post(id, { action: 'apply' }), 'Textos da B copiados para o rascunho da home. Confira em Home e publique.') }}><Wand2 aria-hidden="true"/> Aplicar B ao rascunho da home</button>}
            {status === 'draft' && <button type="button" className="btn secondary" disabled={busy === id} onClick={() => { if (window.confirm('Apagar este rascunho de teste?')) void act(id, () => adminFetch(`/api/v1/admin/experiments?id=${id}`, { method: 'DELETE' }), 'Teste apagado.') }}><Trash2 aria-hidden="true"/> Apagar</button>}
          </div>}
        </div>
        {hypothesis && <p className={styles.help}>Hipótese: {hypothesis}</p>}
        <dl className={styles.variants}>
          <div><dt>A · atual</dt><dd>{results.a.exposed.toLocaleString('pt-BR')} visitas · {results.a.converted.toLocaleString('pt-BR')} clicaram em comprar · <strong>{pct(results.comparison.rateA)}</strong></dd></div>
          <div><dt>B · {100 - splitB}% / {splitB}% do tráfego</dt><dd>{results.b.exposed.toLocaleString('pt-BR')} visitas · {results.b.converted.toLocaleString('pt-BR')} clicaram em comprar · <strong>{pct(results.comparison.rateB)}</strong></dd></div>
        </dl>
        <p className={styles.verdict}>{verdictText(results.comparison)}</p>
        <p className={styles.help}>B: {Object.entries(variantB).map(([field, value]) => `${field === 'title' ? 'título' : field === 'accent' ? 'destaque' : field === 'text' ? 'texto' : 'botão'}: “${value}”`).join(' · ')}</p>
        <p className={styles.help}>{startedAt ? `Iniciado em ${dateTime(startedAt)}` : 'Não iniciado'}{stoppedAt ? ` · encerrado em ${dateTime(stoppedAt)}` : ''}{winner ? ` · vencedor registrado: ${winner.toUpperCase()}` : ''}</p>
      </li>)}</ul>}
    </section>
  </div>
}
