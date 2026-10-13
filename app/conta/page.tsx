'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { ArrowUpRight, Check, ChevronRight, Clock3, Download, GitCompareArrows, Heart, LockKeyhole, LogOut, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useVisitorState } from '@/components/visitor-state-provider'
import { useStoreData } from '@/components/store-data-provider'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { ContentSkeleton } from '@/components/storefront/store-loading'
import { TwoFactorSection } from '@/components/account/two-factor-section'
import { deleteUser, signOut, updateUser, useSession } from '@/lib/auth/client'
import { currentPrice } from '@/lib/catalog/signals'
import { formatPrice } from '@/lib/format'
import styles from './account.module.css'

export default function AccountPage() {
  const state = useVisitorState()
  const { categories, products, offers } = useStoreData()
  const priceCeiling = Math.max(50, Math.ceil(Math.max(0, ...products.map((product) => currentPrice(product, offers))) / 10) * 10)
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [activeSection, setActiveSection] = useState('perfil')
  const [exporting, setExporting] = useState(false)
  const [dataError, setDataError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { if (session?.user.name) setName(session.user.name) }, [session?.user.name])
  useEffect(() => { if (!isPending && !session && !leaving) router.replace('/entrar') }, [isPending, session, leaving, router])
  useEffect(() => {
    const syncSection = () => {
      const section = window.location.hash.slice(1)
      if (['perfil', 'preferencias', 'seguranca', 'dados'].includes(section)) setActiveSection(section)
    }
    syncSection()
    window.addEventListener('hashchange', syncSection)
    return () => window.removeEventListener('hashchange', syncSection)
  }, [])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!name.trim()) { setFeedback({ text: 'Preencha seu nome para salvar.', error: true }); return }
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateUser({ name: name.trim() })
      if (result.error) { setFeedback({ text: result.error.message || 'Não foi possível salvar. Tente novamente.', error: true }); return }
      setFeedback({ text: 'Seu perfil foi atualizado.', error: false })
    } catch {
      setFeedback({ text: 'Não foi possível salvar. Confira sua conexão e tente novamente.', error: true })
    } finally { setSaving(false) }
  }

  async function leaveAccount() {
    if (leaving) return
    setLeaving(true)
    setSessionError('')
    try {
      const result = await signOut()
      if (result.error) { setSessionError('Não foi possível sair. Tente novamente.'); setLeaving(false); return }
      router.replace('/')
    } catch { setSessionError('Não foi possível sair. Confira sua conexão.'); setLeaving(false) }
  }

  async function exportData() {
    if (exporting) return
    setExporting(true)
    setDataError('')
    try {
      const response = await fetch('/api/v1/me/export', { credentials: 'same-origin' })
      if (!response.ok) throw new Error('export')
      const { data } = await response.json()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'garimpo-minha-conta.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch { setDataError('Não foi possível gerar o arquivo. Tente novamente.') } finally { setExporting(false) }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    if (deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const result = await deleteUser(deletePassword ? { password: deletePassword } : {})
      if (result.error) { setDeleteError(result.error.message || 'Não foi possível excluir a conta. Confira a senha e tente de novo.'); setDeleting(false); return }
      setLeaving(true)
      router.replace('/')
    } catch { setDeleteError('Não foi possível excluir a conta. Confira sua conexão e tente de novo.'); setDeleting(false) }
  }

  function toggleCategory(category: string) {
    const selected = state.preferences.categories.includes(category)
    state.savePreferences({ ...state.preferences, categories: selected ? state.preferences.categories.filter((item) => item !== category) : [...state.preferences.categories, category] })
  }

  if (!session) return <StorefrontShell><ContentSkeleton variant="account"/></StorefrontShell>

  const firstName = session.user.name.trim().split(/\s+/)[0] || 'visitante'
  const initials = session.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'G'
  const sections = [
    { id: 'perfil', label: 'Meu perfil', icon: UserRound },
    { id: 'preferencias', label: 'Preferências', icon: SlidersHorizontal },
    { id: 'seguranca', label: 'Segurança', icon: LockKeyhole },
    { id: 'dados', label: 'Seus dados', icon: Download },
  ]
  const shortcuts = [
    { href: '/favoritos', label: 'Seus favoritos', count: state.favorites.length, caption: state.priceDrops.length ? `${state.priceDrops.length} com preço menor` : 'Ver produtos salvos', icon: Heart },
    { href: '/historico', label: 'Vistos recentemente', count: state.recent.length, caption: 'Retomar descobertas', icon: Clock3 },
    { href: '/comparar', label: 'No comparador', count: state.compare.length, caption: 'Comparar produtos', icon: GitCompareArrows },
  ]

  return <StorefrontShell>
    <div className={`container ${styles.account}`}>
      <nav className={styles.breadcrumb} aria-label="Caminho da página"><Link href="/">Início</Link><ChevronRight aria-hidden="true"/><span aria-current="page">Minha conta</span></nav>
      <header className={styles.heading}><div><h1>Seu <em>Garimpo.</em></h1><p>Olá, {firstName}. Seus achados e preferências, em um só lugar.</p></div><Link className={styles.backLink} href="/buscar">Continuar explorando <ArrowUpRight aria-hidden="true"/></Link></header>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Sua conta">
          <div className={styles.identity}><div className={styles.avatar} aria-hidden="true">{initials}</div><strong>{session.user.name}</strong><span>{session.user.email}</span></div>
          <nav className={styles.navigation} aria-label="Seções da conta">{sections.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className={activeSection === id ? styles.current : ''} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setActiveSection(id)}><Icon aria-hidden="true"/>{label}</a>)}<Link href="/privacidade"><ShieldCheck aria-hidden="true"/>Privacidade<ArrowUpRight aria-hidden="true"/></Link></nav>
          <button className={styles.signOut} type="button" disabled={leaving} onClick={leaveAccount}><LogOut aria-hidden="true"/>{leaving ? 'Saindo…' : 'Sair da conta'}</button>
          {sessionError && <p className={styles.sessionError} role="alert">{sessionError}</p>}
          <div className={styles.sidebarNote}><LockKeyhole aria-hidden="true"/><p>Você controla suas informações e as preferências da sua conta.</p></div>
        </aside>

        <div className={styles.content}>
          <nav className={styles.shortcuts} aria-label="Suas descobertas">{shortcuts.map(({ href, label, count, caption, icon: Icon }) => <Link href={href} className={styles.shortcut} key={href}><div><span className={styles.shortcutLabel}><Icon aria-hidden="true"/>{label}</span><strong>{count.toLocaleString('pt-BR')}</strong><small>{caption}</small></div><ArrowUpRight aria-hidden="true"/></Link>)}</nav>

          <section className={styles.panel} id="perfil" aria-labelledby="profile-title">
            <div className={styles.panelHeader}><div><span className={styles.sectionLabel}>Seus dados</span><h2 id="profile-title">Um pouco sobre você</h2><p>Como vamos chamar você por aqui.</p></div><UserRound aria-hidden="true"/></div>
            <form className={styles.profileForm} onSubmit={saveProfile} aria-busy={saving}>
              <div className={styles.fields}><label className={styles.field}>Seu nome<input name="name" autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); setFeedback(null) }} required disabled={saving}/></label><label className={styles.field}>E-mail<input name="email" type="email" autoComplete="email" value={session.user.email} readOnly aria-describedby="email-help"/><small id="email-help">O e-mail de acesso não pode ser alterado por aqui.</small></label></div>
              <div className={styles.formFooter}><span>As alterações serão salvas na sua conta.</span><button className={styles.saveButton} type="submit" disabled={saving || name.trim() === session.user.name}>{saving ? 'Salvando…' : 'Salvar alterações'}<Check aria-hidden="true"/></button></div>
              {feedback && <p className={`${styles.formMessage} ${feedback.error ? styles.error : ''}`} role={feedback.error ? 'alert' : 'status'}>{!feedback.error && <Check aria-hidden="true"/>}{feedback.text}</p>}
            </form>
          </section>

          <section className={styles.panel} id="preferencias" aria-labelledby="preferences-title">
            <div className={styles.panelHeader}><div><span className={styles.sectionLabel}>Do seu jeito</span><h2 id="preferences-title">O que chama sua atenção?</h2><p>Ajuste seus interesses e a faixa de preço que você prefere.</p></div><SlidersHorizontal aria-hidden="true"/></div>
            <div className={styles.preferences}>
              <fieldset className={styles.categories}><legend>Seus interesses</legend><div className={styles.categoryOptions}>{categories.map((category) => { const selected = state.preferences.categories.includes(category.name); return <button className={styles.category} key={category.id} type="button" aria-pressed={selected} onClick={() => toggleCategory(category.name)}><span aria-hidden="true">{selected && <Check/>}</span>{category.name}</button> })}</div></fieldset>
              <div className={styles.pricePreference}><div className={styles.priceHeading}><label htmlFor="preferred-price">Quanto você pretende gastar?</label><output htmlFor="preferred-price">Até {formatPrice(Math.min(state.preferences.maxPrice, priceCeiling))}</output></div><input id="preferred-price" type="range" min="10" max={priceCeiling} step="10" value={Math.min(state.preferences.maxPrice, priceCeiling)} aria-valuetext={`Até ${formatPrice(Math.min(state.preferences.maxPrice, priceCeiling))}`} onChange={(event) => state.savePreferences({ ...state.preferences, maxPrice: Number(event.target.value) })}/><div className={styles.rangeLabels}><span>R$ 10</span><span>{formatPrice(priceCeiling)}</span></div></div>
            </div>
            <div className={styles.communication}><h3>Alertas e novidades</h3><p>Quando um produto salvo fica mais barato, mostramos em Favoritos e aqui no atalho. Avisos por e-mail ainda não existem; sua escolha fica registrada para quando existirem.</p><div className={styles.toggleRow}><div><strong id="price-alert-label">Quedas de preço</strong><small>Interesse em alertas sobre produtos mais baratos.</small></div><button className={styles.switch} type="button" role="switch" aria-checked={state.preferences.notifications} aria-labelledby="price-alert-label" onClick={() => state.savePreferences({ ...state.preferences, notifications: !state.preferences.notifications })}><span/></button></div><div className={styles.toggleRow}><div><strong id="newsletter-label">Seleção semanal</strong><small>Interesse em novidades e seleções editoriais.</small></div><button className={styles.switch} type="button" role="switch" aria-checked={state.preferences.newsletter} aria-labelledby="newsletter-label" onClick={() => state.savePreferences({ ...state.preferences, newsletter: !state.preferences.newsletter })}><span/></button></div></div>
            <p className={styles.personalHint}>{state.cookiePreferences.personalization
              ? <>Seus interesses aparecem na aba “Para você” da <Link href="/#ofertas">página inicial</Link>.</>
              : <>Para ver seus interesses na página inicial, permita a personalização em <Link href="/privacidade">Privacidade</Link>.</>}</p>
            <p className={styles.autosave}><Check aria-hidden="true"/>Preferências salvas automaticamente neste navegador.</p>
          </section>

          <TwoFactorSection/>

          <section className={styles.panel} id="dados" aria-labelledby="data-title">
            <div className={styles.panelHeader}><div><span className={styles.sectionLabel}>Privacidade</span><h2 id="data-title">Seus dados</h2><p>Baixe uma cópia do que guardamos na sua conta ou exclua a conta.</p></div><ShieldCheck aria-hidden="true"/></div>
            <div className={styles.dataBody}>
              <div className={styles.dataRow}>
                <div><strong>Baixar meus dados</strong><small>Perfil e favoritos salvos na conta, em um arquivo JSON.</small></div>
                <button type="button" className={styles.outlineButton} onClick={exportData} disabled={exporting}>{exporting ? 'Preparando…' : 'Baixar arquivo'}</button>
              </div>
              {dataError && <p className={`${styles.formMessage} ${styles.error}`} role="alert">{dataError}</p>}
              <div className={styles.dataRow}>
                <div><strong>Excluir minha conta</strong><small>Apaga a conta e os favoritos salvos nela. Não dá para desfazer.</small></div>
                {!confirmingDelete && <button type="button" className={styles.dangerButton} onClick={() => setConfirmingDelete(true)}>Excluir conta</button>}
              </div>
              {confirmingDelete && <form className={styles.deleteForm} onSubmit={deleteAccount} aria-busy={deleting}>
                <label className={styles.field}>Senha da conta<input name="password" type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => { setDeletePassword(event.target.value); setDeleteError('') }} placeholder="Se você entra com o Google, deixe em branco"/></label>
                {deleteError && <p className={`${styles.formMessage} ${styles.error}`} role="alert">{deleteError}</p>}
                <div className={styles.deleteActions}>
                  <button type="button" className={styles.outlineButton} onClick={() => { setConfirmingDelete(false); setDeletePassword(''); setDeleteError('') }}>Cancelar</button>
                  <button type="submit" className={styles.dangerButton} disabled={deleting}>{deleting ? 'Excluindo…' : 'Excluir definitivamente'}</button>
                </div>
              </form>}
            </div>
          </section>

          <div className={styles.privacyNote}><ShieldCheck aria-hidden="true"/><p>Seus interesses ficam salvos neste navegador. <Link href="/privacidade">Gerenciar privacidade e cookies</Link></p></div>
        </div>
      </div>
    </div>
  </StorefrontShell>
}
