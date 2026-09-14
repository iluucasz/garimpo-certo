'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { requestPasswordReset, signIn, signUp } from '@/lib/auth/client'
import { GoogleIcon } from './google-icon'

export function AuthForm({ mode }: { mode: 'entrar' | 'cadastro' | 'recuperar' }) {
  const router = useRouter()
  const [sent, setSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const copy = { entrar: ['Bem-vindo de volta.', 'Entre para rever seus favoritos e preferências.', 'Entrar'], cadastro: ['Crie sua conta.', 'Seus dados ficam protegidos com sessão real.', 'Criar conta'], recuperar: ['Recupere seu acesso.', 'Enviaremos um link de redefinição por e-mail.', 'Enviar link'] }[mode]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    const name = String(data.get('name') ?? '').trim() || 'Usuário'

    if (mode === 'recuperar') {
      const { error: requestError } = await requestPasswordReset({ email, redirectTo: '/entrar' })
      if (requestError) setError(requestError.message ?? 'Não foi possível enviar o link.')
      else setSent(true)
      setSubmitting(false)
      return
    }

    const { error: authError } = mode === 'cadastro'
      ? await signUp.email({ email, password, name })
      : await signIn.email({ email, password })

    if (authError) { setError(authError.message ?? 'Não foi possível autenticar.'); setSubmitting(false); return }
    router.push('/conta')
  }

  async function withGoogle() {
    setError('')
    const { error: authError } = await signIn.social({ provider: 'google', callbackURL: '/conta' })
    if (authError) setError(authError.message ?? 'Login com Google indisponível no momento.')
  }

  return <div className="auth-card"><div className="kicker">CONTA</div><h1>{copy[0]}</h1><p>{copy[1]}</p>{sent ? <div className="empty-state" style={{ padding: 30 }}><CheckCircle2/><h2>Link enviado</h2><p>Se o e-mail existir, você receberá um link de redefinição em instantes.</p><Link href="/entrar" className="btn primary">Voltar para entrar</Link></div> : <form className="form-stack" onSubmit={submit}>{mode === 'cadastro' && <label>Nome<input className="input" name="name" autoComplete="name" required placeholder="Seu nome"/></label>}<label>E-mail<input className="input" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com"/></label>{mode !== 'recuperar' && <label>Senha<span className="password-field"><input className="input" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'cadastro' ? 'new-password' : 'current-password'} required minLength={8} placeholder="Mínimo de 8 caracteres"/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff/> : <Eye/>}</button></span></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary" type="submit" disabled={submitting}>{submitting ? 'Validando…' : copy[2]}</button>{mode === 'entrar' && <><Link href="/recuperar-senha" className="text-link">Esqueci minha senha</Link><small>Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></small></>}{mode === 'cadastro' && <small>Já tem uma conta? <Link href="/entrar">Entrar</Link></small>}</form>}{mode !== 'recuperar' && !sent && <><div className="account-divider"><span>ou</span></div><button type="button" className="btn secondary account-google" onClick={withGoogle}><GoogleIcon/> Continuar com o Google</button></>}</div>
}
