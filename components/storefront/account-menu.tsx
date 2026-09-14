'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { Heart, LayoutDashboard, LogOut, Settings, UserRound } from 'lucide-react'
import { signIn, signOut, signUp, useSession } from '@/lib/auth/client'
import { GoogleIcon } from './google-icon'

type Mode = 'entrar' | 'cadastro'

export function AccountMenu() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('entrar')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isStaff, setIsStaff] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const checkedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!session || checkedUserId.current === session.user.id) return
    checkedUserId.current = session.user.id
    fetch('/api/v1/me')
      .then((response) => response.ok ? response.json() : null)
      .then((body) => setIsStaff((body?.data.roles.length ?? 0) > 0))
      .catch(() => {})
  }, [session])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false) }
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  function toggle() {
    setOpen((current) => !current)
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true); setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    const name = String(data.get('name') ?? '').trim() || 'Usuário'
    const { error: authError } = mode === 'cadastro' ? await signUp.email({ email, password, name }) : await signIn.email({ email, password })
    setSubmitting(false)
    if (authError) { setError(authError.message ?? 'Não foi possível autenticar.'); return }
    setOpen(false)
    router.push('/conta')
  }

  async function withGoogle() {
    setError('')
    const { error: authError } = await signIn.social({ provider: 'google', callbackURL: '/conta' })
    if (authError) setError(authError.message ?? 'Login com Google indisponível no momento.')
  }

  return <div className="account-menu" ref={rootRef}>
    <button type="button" className="account-trigger" aria-label="Minha conta" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><UserRound /></button>
    {open && !session && !isPending && <div className="account-panel" role="menu">
      <div className="account-tabs">
        <button type="button" className={mode === 'entrar' ? 'active' : ''} onClick={() => { setMode('entrar'); setError('') }}>Entrar</button>
        <button type="button" className={mode === 'cadastro' ? 'active' : ''} onClick={() => { setMode('cadastro'); setError('') }}>Criar conta</button>
      </div>
      <form className="account-form" onSubmit={submit}>
        {mode === 'cadastro' && <input className="input" name="name" placeholder="Seu nome" autoComplete="name" required />}
        <input className="input" name="email" type="email" placeholder="voce@exemplo.com" autoComplete="email" required />
        <input className="input" name="password" type="password" placeholder="Senha" autoComplete={mode === 'cadastro' ? 'new-password' : 'current-password'} minLength={8} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={submitting}>{submitting ? 'Validando…' : mode === 'cadastro' ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <div className="account-divider"><span>ou</span></div>
      <button type="button" className="btn secondary account-google" onClick={withGoogle}><GoogleIcon /> Continuar com o Google</button>
      {mode === 'entrar' && <Link href="/recuperar-senha" className="text-link account-forgot" onClick={() => setOpen(false)}>Esqueci minha senha</Link>}
    </div>}
    {open && session && <div className="account-panel" role="menu">
      <div className="account-user"><strong>{session.user.name}</strong><small>{session.user.email}</small></div>
      <Link href="/conta" role="menuitem" onClick={() => setOpen(false)}><Settings /> Minha conta</Link>
      <Link href="/favoritos" role="menuitem" onClick={() => setOpen(false)}><Heart /> Favoritos</Link>
      {isStaff && <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}><LayoutDashboard /> Painel admin</Link>}
      <button type="button" role="menuitem" onClick={async () => { await signOut(); setOpen(false); router.push('/') }}><LogOut /> Sair</button>
    </div>}
  </div>
}
