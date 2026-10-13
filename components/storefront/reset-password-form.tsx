'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { resetPassword } from '@/lib/auth/client'
import styles from './content-pages.module.css'

export function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token')
  const linkError = params.get('error')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!token || linkError) {
    return <section className={styles.shell}>
      <div className={styles.card}>
        <h1>Link inválido ou expirado.</h1>
        <p className={styles.lead}>Por segurança, o link de redefinição vale por 1 hora e só pode ser usado uma vez. Peça um novo para continuar.</p>
        <div className={styles.form}>
          <Link className={styles.submit} href="/recuperar-senha">Pedir novo link</Link>
          <div className={styles.links}><Link href="/entrar">Voltar para entrar</Link></div>
        </div>
      </div>
    </section>
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')
    if (password !== confirmation) { setError('As senhas não são iguais. Digite a mesma senha nos dois campos.'); return }
    setSubmitting(true)
    setError('')
    try {
      const { error: resetError } = await resetPassword({ newPassword: password, token: token! })
      if (resetError) setError(resetError.message ?? 'Não foi possível redefinir a senha. Peça um novo link e tente de novo.')
      else setDone(true)
    } catch {
      setError('Não foi possível redefinir a senha. Confira sua conexão e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return <section className={styles.shell}>
    <div className={styles.card}>
      <h1>Escolha uma nova senha.</h1>
      <p className={styles.lead}>Use pelo menos 8 caracteres. Depois de salvar, você entra com a nova senha.</p>
      {done
        ? <div className={styles.done} role="status">
          <CheckCircle2 aria-hidden="true"/>
          <h2>Senha atualizada</h2>
          <p>Pronto. Entre com a sua nova senha.</p>
          <Link href="/entrar">Entrar</Link>
        </div>
        : <form className={styles.form} onSubmit={submit} aria-busy={submitting}>
          <label className={styles.field}>Nova senha
            <span className={styles.passwordField}>
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres"/>
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button>
            </span>
          </label>
          <label className={styles.field}>Repita a nova senha<input name="confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8}/></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar nova senha'}</button>
        </form>}
    </div>
  </section>
}
