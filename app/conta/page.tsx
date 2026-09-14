'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { Bell, Check, Clock3, GitCompareArrows, Heart, LogOut, Shield, Trash2 } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { signOut, updateUser, useSession } from '@/lib/auth/client'

export default function AccountPage() {
  const state = useMock()
  const { categories } = useStoreData()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { if (session?.user.name) setName(session.user.name) }, [session?.user.name])
  useEffect(() => { if (!isPending && !session) router.push('/entrar') }, [isPending, session, router])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    await updateUser({ name })
    setMessage('Perfil atualizado.')
  }

  function toggleCategory(category: string) {
    const selected = state.preferences.categories.includes(category)
    state.savePreferences({ ...state.preferences, categories: selected ? state.preferences.categories.filter((item) => item !== category) : [...state.preferences.categories, category] })
  }

  if (!session) return null

  return <StorefrontShell>
    <section className="page-hero container"><div className="kicker">CONTA</div><h1>Olá, {session.user.name}.</h1><p>Preferências de descoberta salvas neste navegador; sua conta e sessão são reais.</p></section>
    <section className="container section" style={{ paddingTop: 10 }}>
      <div className="stat-grid"><Link className="stat-card" href="/favoritos"><Heart/><span>Favoritos</span><strong>{state.favorites.length}</strong><small>Ver produtos salvos</small></Link><Link className="stat-card" href="/historico"><Clock3/><span>Vistos recentemente</span><strong>{state.recent.length}</strong><small>Revisar histórico</small></Link><Link className="stat-card" href="/comparar"><GitCompareArrows/><span>No comparador</span><strong>{state.compare.length}</strong><small>Comparar escolhas</small></Link><Link className="stat-card" href="/privacidade"><Shield/><span>Privacidade</span><strong>Local</strong><small>Gerenciar consentimento</small></Link></div>
      <div className="admin-grid">
        <div className="panel"><h2>Preferências de descoberta</h2><p>Escolha os temas que devem influenciar suas vitrines.</p><div className="preference-chips">{categories.map((category) => <button key={category.id} className={state.preferences.categories.includes(category.name) ? 'active' : ''} onClick={() => toggleCategory(category.name)}>{state.preferences.categories.includes(category.name) && <Check/>}{category.name}</button>)}</div><label>Faixa de preço preferida: até R$ {state.preferences.maxPrice.toLocaleString('pt-BR')}<input type="range" min="250" max="4000" step="50" value={state.preferences.maxPrice} onChange={(event) => state.savePreferences({ ...state.preferences, maxPrice: Number(event.target.value) })}/></label><div className="toggle-row"><span><strong>Alertas de queda de preço</strong><small>Simulação local, sem envios.</small></span><button className={`toggle ${state.preferences.notifications ? 'on' : ''}`} aria-pressed={state.preferences.notifications} onClick={() => state.savePreferences({ ...state.preferences, notifications: !state.preferences.notifications })}/></div><div className="toggle-row"><span><strong>Resumo editorial semanal</strong><small>Preferência pronta para um mailer real.</small></span><button className={`toggle ${state.preferences.newsletter ? 'on' : ''}`} aria-pressed={state.preferences.newsletter} onClick={() => state.savePreferences({ ...state.preferences, newsletter: !state.preferences.newsletter })}/></div></div>
        <form className="panel" onSubmit={saveProfile}><h2>Perfil</h2><div className="form-stack"><label>Nome<input className="input" value={name} onChange={(event) => setName(event.target.value)} required/></label><label>E-mail<input className="input" type="email" value={session.user.email} disabled/></label><button className="btn primary" type="submit">Salvar alterações</button><button className="btn secondary" type="button" onClick={async () => { await signOut(); router.push('/') }}><LogOut/> Sair da conta</button>{message && <p className="form-success" role="status">{message}</p>}</div></form>
      </div>
      <div className="admin-grid"><div className="panel"><h2><Bell/> Buscas salvas</h2>{state.savedSearches.length ? state.savedSearches.map((search) => <div className="toggle-row" key={search}><Link href={`/buscar?q=${encodeURIComponent(search)}`}>{search}</Link><button className="icon-btn static" aria-label={`Excluir busca ${search}`} onClick={() => state.removeSavedSearch(search)}><Trash2/></button></div>) : <p>Salve uma busca na página de catálogo para vê-la aqui.</p>}</div><div className="panel"><h2>Avisos</h2><p>Notificações e alertas permanecem simulados. A interface e os contratos já separam preferências do futuro canal de entrega.</p></div></div>
    </section>
  </StorefrontShell>
}
