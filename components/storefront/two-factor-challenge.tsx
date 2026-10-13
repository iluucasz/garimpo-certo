'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { twoFactor } from '@/lib/auth/client'
import { safeRedirect } from '@/lib/auth/redirect'
import styles from './content-pages.module.css'

/** Segundo passo do login: código do aplicativo autenticador ou um código de recuperação. */
export function TwoFactorChallenge() {
  const router = useRouter()
  const [next, setNext] = useState('/conta')
  const [useBackup, setUseBackup] = useState(false)
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setNext(safeRedirect(new URLSearchParams(window.location.search).get('next'))) }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const clean = code.replace(/\s+/g, '')
    const result = useBackup
      ? await twoFactor.verifyBackupCode({ code: clean })
      : await twoFactor.verifyTotp({ code: clean, trustDevice: trust })
    if (result.error) {
      setError(result.error.message ?? 'Código inválido. Confira e tente de novo.')
      setBusy(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return <section className={styles.shell}>
    <div className={styles.card}>
      <h1>Confirme que é você.</h1>
      <p className={styles.lead}>{useBackup
        ? 'Digite um dos códigos de recuperação que você guardou ao ativar a verificação. Cada código vale uma vez.'
        : 'Abra o aplicativo autenticador e digite o código de 6 dígitos da sua conta no Garimpo certo.'}</p>
      <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        <label className={styles.field}>{useBackup ? 'Código de recuperação' : 'Código do aplicativo'}
          <input name="code" value={code} onChange={(event) => { setCode(event.target.value); setError('') }}
            inputMode={useBackup ? 'text' : 'numeric'} autoComplete="one-time-code" autoFocus required
            placeholder={useBackup ? 'xxxxx-xxxxx' : '000000'} maxLength={useBackup ? 24 : 8}/>
        </label>
        {!useBackup && <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
          <input type="checkbox" checked={trust} onChange={(event) => setTrust(event.target.checked)}/>
          Confiar neste aparelho por 30 dias
        </label>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.submit} type="submit" disabled={busy}><ShieldCheck aria-hidden="true"/>{busy ? 'Verificando…' : 'Verificar e entrar'}</button>
        <button type="button" className={styles.secondary} onClick={() => { setUseBackup((value) => !value); setCode(''); setError('') }}>
          <KeyRound aria-hidden="true"/>{useBackup ? 'Usar o aplicativo autenticador' : 'Usar um código de recuperação'}
        </button>
        <div className={styles.links}><Link href="/entrar">Voltar para entrar</Link></div>
      </form>
    </div>
  </section>
}
