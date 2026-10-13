'use client'

import { FormEvent, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { twoFactor, useSession } from '@/lib/auth/client'
import styles from '@/app/conta/account.module.css'

type Step = 'idle' | 'password' | 'scan' | 'codes' | 'regenerate' | 'disable'

const secretFrom = (uri: string) => { try { return new URL(uri).searchParams.get('secret') ?? '' } catch { return '' } }

/** Ativação, códigos de recuperação e desativação da verificação em duas etapas (aplicativo autenticador). */
export function TwoFactorSection() {
  const { data: session, refetch } = useSession()
  const enabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled)
  const [step, setStep] = useState<Step>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [uri, setUri] = useState('')
  const [qr, setQr] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [required, setRequired] = useState<{ required: boolean; enforced: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/v1/me').then((response) => response.ok ? response.json() : null)
      .then((body) => { if (body?.data?.mfa) setRequired({ required: body.data.mfa.required, enforced: body.data.mfa.enforced }) })
      .catch(() => undefined)
  }, [enabled])

  useEffect(() => {
    if (!uri) { setQr(''); return }
    QRCode.toDataURL(uri, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(''))
  }, [uri])

  const reset = () => { setStep('idle'); setPassword(''); setCode(''); setUri(''); setError(''); setBusy(false) }
  const fail = (text: string) => { setError(text); setBusy(false) }

  async function start(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await twoFactor.enable({ password })
    if (result.error || !result.data) return fail(result.error?.message ?? 'Não foi possível iniciar. Confira a senha.')
    setUri(String((result.data as { totpURI?: string }).totpURI ?? ''))
    setCodes((result.data as { backupCodes?: string[] }).backupCodes ?? [])
    setPassword(''); setBusy(false); setStep('scan')
  }

  async function confirm(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await twoFactor.verifyTotp({ code: code.replace(/\s+/g, '') })
    if (result.error) return fail(result.error.message ?? 'Código inválido. Confira o aplicativo e tente de novo.')
    await refetch()
    setCode(''); setBusy(false); setStep('codes'); setMessage('Verificação em duas etapas ativada.')
  }

  async function regenerate(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await twoFactor.generateBackupCodes({ password })
    if (result.error || !result.data) return fail(result.error?.message ?? 'Não foi possível gerar. Confira a senha.')
    setCodes((result.data as { backupCodes?: string[] }).backupCodes ?? [])
    setPassword(''); setBusy(false); setStep('codes'); setMessage('Novos códigos gerados. Os anteriores deixaram de valer.')
  }

  async function disable(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await twoFactor.disable({ password })
    if (result.error) return fail(result.error.message ?? 'Não foi possível desativar. Confira a senha.')
    await refetch()
    reset(); setMessage('Verificação em duas etapas desativada.')
  }

  return <section className={styles.panel} id="seguranca" aria-labelledby="security-title">
    <div className={styles.panelHeader}><div><span className={styles.sectionLabel}>Segurança</span><h2 id="security-title">Verificação em duas etapas</h2><p>Além da senha, pede um código do aplicativo autenticador. Protege o painel mesmo se a senha vazar.</p></div><ShieldCheck aria-hidden="true"/></div>
    <div className={styles.dataBody}>
      {required?.required && !enabled && <p className={`${styles.formMessage} ${styles.error}`} role="note">
        Seu papel dá acesso a configurações e pessoas. {required.enforced ? 'O painel fica bloqueado até você ativar.' : 'Ative agora: em breve o painel passa a exigir.'}
      </p>}
      {message && <p className={styles.formMessage} role="status">{message}</p>}

      {step === 'idle' && <div className={styles.dataRow}>
        <div><strong>{enabled ? 'Ativada' : 'Desativada'}</strong><small>{enabled ? 'Pedimos o código ao entrar neste aparelho, a menos que você tenha marcado “confiar por 30 dias”.' : 'Recomendado para quem administra o site.'}</small></div>
        {!enabled
          ? <button type="button" className={styles.outlineButton} onClick={() => { setMessage(''); setStep('password') }}>Ativar</button>
          : <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={styles.outlineButton} onClick={() => { setMessage(''); setStep('regenerate') }}>Novos códigos</button>
            <button type="button" className={styles.dangerButton} onClick={() => { setMessage(''); setStep('disable') }}>Desativar</button>
          </span>}
      </div>}

      {(step === 'password' || step === 'regenerate' || step === 'disable') && <form className={styles.deleteForm} onSubmit={step === 'password' ? start : step === 'regenerate' ? regenerate : disable} aria-busy={busy}>
        <label className={styles.field}>Senha da conta
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} required/>
          <small>Contas que entram só com o Google precisam definir uma senha antes (use “Esqueci minha senha”).</small>
        </label>
        {error && <p className={`${styles.formMessage} ${styles.error}`} role="alert">{error}</p>}
        <div className={styles.deleteActions}>
          <button type="button" className={styles.outlineButton} onClick={reset}>Cancelar</button>
          <button type="submit" className={step === 'disable' ? styles.dangerButton : styles.saveButton} disabled={busy || !password}>
            {busy ? 'Aguarde…' : step === 'password' ? 'Continuar' : step === 'regenerate' ? 'Gerar novos códigos' : 'Desativar'}
          </button>
        </div>
      </form>}

      {step === 'scan' && <form className={styles.deleteForm} onSubmit={confirm} aria-busy={busy}>
        <p><strong>1.</strong> No aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy…), escaneie o QR code.</p>
        {qr && <img src={qr} alt="QR code para o aplicativo autenticador" width={200} height={200} style={{ background: '#fff', padding: 8, borderRadius: 12, border: '1px solid var(--border)' }}/>}
        {secretFrom(uri) && <p><small>Sem câmera? Digite esta chave no aplicativo: <code style={{ overflowWrap: 'anywhere' }}>{secretFrom(uri)}</code></small></p>}
        <label className={styles.field}><span><strong>2.</strong> Digite o código de 6 dígitos que o aplicativo mostra</span>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => { setCode(event.target.value); setError('') }} placeholder="000000" required/>
        </label>
        {error && <p className={`${styles.formMessage} ${styles.error}`} role="alert">{error}</p>}
        <div className={styles.deleteActions}>
          <button type="button" className={styles.outlineButton} onClick={reset}>Cancelar</button>
          <button type="submit" className={styles.saveButton} disabled={busy || code.length < 6}>{busy ? 'Verificando…' : 'Confirmar e ativar'}</button>
        </div>
      </form>}

      {step === 'codes' && <div className={styles.deleteForm}>
        <p><KeyRound aria-hidden="true" size={16}/> <strong>Guarde estes códigos de recuperação.</strong> Cada um vale uma vez e é a única forma de entrar se você perder o celular. Eles não aparecem de novo.</p>
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}>
          {codes.map((item) => <li key={item}><code>{item}</code></li>)}
        </ul>
        <div className={styles.deleteActions}>
          <button type="button" className={styles.outlineButton} onClick={() => { void navigator.clipboard?.writeText(codes.join('\n')) }}>Copiar códigos</button>
          <button type="button" className={styles.saveButton} onClick={() => { setCodes([]); reset() }}>Já guardei</button>
        </div>
      </div>}
    </div>
  </section>
}
