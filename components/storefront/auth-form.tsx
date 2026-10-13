'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { requestPasswordReset, signIn, signUp } from '@/lib/auth/client'
import { safeRedirect } from '@/lib/auth/redirect'
import { GoogleIcon } from './google-icon'
import styles from './content-pages.module.css'

type Mode = 'entrar' | 'cadastro' | 'recuperar'

const copy: Record<Mode, { title: string; lead: string; submit: string; busy: string }> = {
  entrar: { title: 'Bem-vindo de volta.', lead: 'Entre para rever seus favoritos e preferências.', submit: 'Entrar', busy: 'Entrando…' },
  cadastro: { title: 'Crie sua conta.', lead: 'Salve favoritos e preferências na sua conta e acesse de qualquer aparelho.', submit: 'Criar conta', busy: 'Criando conta…' },
  recuperar: { title: 'Recupere seu acesso.', lead: 'Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.', submit: 'Enviar link', busy: 'Enviando…' },
}

export function AuthForm({ mode, emailEnabled = false, googleEnabled = false }: { mode: Mode; emailEnabled?: boolean; googleEnabled?: boolean }) {
  const router = useRouter()
  // Destino depois do login (`?next=/convite/…`). Lido no navegador para a página continuar estática; só caminhos do próprio site.
  const [redirectTo, setRedirectTo] = useState('/conta')
  useEffect(() => { setRedirectTo(safeRedirect(new URLSearchParams(window.location.search).get('next'))) }, [])
  const [sent, setSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const text = copy[mode]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    const name = String(data.get('name') ?? '').trim() || 'Usuário'

    if (mode === 'recuperar') {
      const { error: requestError } = await requestPasswordReset({ email, redirectTo: '/redefinir-senha' })
      if (requestError) setError(requestError.message ?? 'Não foi possível registrar o pedido. Tente novamente.')
      else setSent(true)
      setSubmitting(false)
      return
    }

    const result = mode === 'cadastro'
      ? await signUp.email({ email, password, name })
      : await signIn.email({ email, password })

    if (result.error) { setError(result.error.message ?? 'Não foi possível autenticar. Confira os dados e tente novamente.'); setSubmitting(false); return }
    // Conta com verificação em duas etapas: a sessão só vale depois do código do aplicativo autenticador.
    if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      router.push(redirectTo === '/conta' ? '/verificar' : `/verificar?next=${encodeURIComponent(redirectTo)}`)
      return
    }
    router.push(redirectTo)
  }

  async function withGoogle() {
    setError('')
    const { error: authError } = await signIn.social({ provider: 'google', callbackURL: redirectTo })
    if (authError) setError(authError.message ?? 'Entrar com o Google não está disponível no momento.')
  }

  return <section className={styles.shell}>
    <div className={styles.card}>
      <h1>{text.title}</h1>
      <p className={styles.lead}>{text.lead}</p>

      {mode === 'recuperar' && !sent && !emailEnabled && <p className={styles.notice} role="note">O envio do e-mail de redefinição ainda não está ativo. Seu pedido é registrado, mas a mensagem pode não chegar.</p>}

      {sent
        ? <div className={styles.done} role="status">
          <CheckCircle2 aria-hidden="true"/>
          <h2>{emailEnabled ? 'Verifique seu e-mail' : 'Pedido registrado'}</h2>
          <p>{emailEnabled
            ? 'Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Ele vale por 1 hora. Confira também a caixa de spam.'
            : 'Se o e-mail estiver cadastrado, a redefinição será enviada assim que o envio por e-mail estiver ativo. Por enquanto, a mensagem pode não chegar.'}</p>
          <Link href="/entrar">Voltar para entrar</Link>
        </div>
        : <form className={styles.form} onSubmit={submit} aria-busy={submitting}>
          {mode === 'cadastro' && <label className={styles.field}>Nome<input name="name" autoComplete="name" required placeholder="Como devemos chamar você"/></label>}
          <label className={styles.field}>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com"/></label>
          {mode !== 'recuperar' && <label className={styles.field}>Senha
            <span className={styles.passwordField}>
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'cadastro' ? 'new-password' : 'current-password'} required minLength={8} placeholder="Mínimo de 8 caracteres"/>
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button>
            </span>
          </label>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? text.busy : text.submit}</button>
          {mode === 'entrar' && <div className={styles.links}><Link href="/recuperar-senha">Esqueci minha senha</Link><span>Ainda não tem conta? <Link className={styles.inlineLink} href={redirectTo === '/conta' ? '/cadastro' : `/cadastro?next=${encodeURIComponent(redirectTo)}`}>Criar conta</Link></span></div>}
          {mode === 'cadastro' && <div className={styles.links}><span>Já tem uma conta? <Link className={styles.inlineLink} href={redirectTo === '/conta' ? '/entrar' : `/entrar?next=${encodeURIComponent(redirectTo)}`}>Entrar</Link></span></div>}
          {mode === 'recuperar' && <div className={styles.links}><Link href="/entrar">Voltar para entrar</Link></div>}
        </form>}

      {mode !== 'recuperar' && !sent && googleEnabled && <>
        <div className={styles.divider}><span>ou</span></div>
        <button type="button" className={styles.secondary} onClick={withGoogle}><GoogleIcon/>Continuar com o Google</button>
      </>}
    </div>
  </section>
}
