'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { signOut, useSession } from '@/lib/auth/client'
import { roleLabels, type AdminRole } from '@/lib/auth/rbac'
import styles from './content-pages.module.css'

type Invite = { email: string; role: AdminRole; status: 'pending' | 'accepted' | 'expired' | 'revoked'; expiresAt: string }

const closedText: Record<string, string> = {
  accepted: 'Este convite já foi usado.',
  expired: 'Este convite venceu. Peça um novo a quem convidou você.',
  revoked: 'Este convite foi cancelado. Peça um novo a quem convidou você.',
}

/** Página do convite: mostra o papel, pede o login e aceita com a conta cujo e-mail é o do convite. */
export function InviteAccept({ token }: { token: string }) {
  const { data: session, isPending } = useSession()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [lookup, setLookup] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState<AdminRole | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/invites/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 404) { setLookup('missing'); return }
        if (!response.ok) { setLookup('error'); return }
        setInvite((await response.json()).data as Invite)
        setLookup('ok')
      })
      .catch(() => { if (!cancelled) setLookup('error') })
    return () => { cancelled = true }
  }, [token])

  async function accept() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/v1/invites/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) { setError(body?.error?.message ?? 'Não foi possível aceitar o convite.'); return }
      setAccepted(body.data.role as AdminRole)
    } catch {
      setError('Sem conexão. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const next = encodeURIComponent(`/convite/${token}`)

  return <section className={styles.shell}>
    <div className={styles.card}>
      <h1>Convite para a equipe</h1>
      {lookup === 'loading' && <p className={styles.lead} role="status">Verificando o convite…</p>}
      {lookup === 'missing' && <p className={styles.error} role="alert">Convite não encontrado. Confira o link ou peça um novo.</p>}
      {lookup === 'error' && <p className={styles.error} role="alert">Não foi possível verificar o convite agora. Tente de novo em instantes.</p>}

      {lookup === 'ok' && invite && (accepted
        ? <div className={styles.done} role="status">
          <CheckCircle2 aria-hidden="true"/>
          <h2>Convite aceito</h2>
          <p>Você agora tem o papel <strong>{roleLabels[accepted]}</strong>. O painel está disponível no menu da sua conta.</p>
          <Link href="/admin">Abrir o painel</Link>
        </div>
        : invite.status !== 'pending'
          ? <p className={styles.error} role="alert">{closedText[invite.status]}</p>
          : <>
            <p className={styles.lead}>Você foi convidado como <strong>{roleLabels[invite.role] ?? invite.role}</strong>. O convite é para a conta com o e-mail <strong>{invite.email}</strong>.</p>
            {isPending && <p className={styles.lead} role="status">Verificando sua sessão…</p>}
            {!isPending && !session && <div className={styles.form}>
              <p className={styles.lead} style={{ margin: 0 }}>Entre ou crie a conta com esse e-mail para aceitar.</p>
              <Link className={styles.submit} href={`/entrar?next=${next}`}>Entrar</Link>
              <Link className={styles.secondary} href={`/cadastro?next=${next}`}>Criar conta</Link>
            </div>}
            {!isPending && session && <div className={styles.form}>
              <p className={styles.lead} style={{ margin: 0 }}>Você está como <strong>{session.user.email}</strong>.</p>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="button" className={styles.submit} onClick={accept} disabled={busy} aria-busy={busy}><ShieldCheck aria-hidden="true"/>{busy ? 'Aceitando…' : 'Aceitar convite'}</button>
              <button type="button" className={styles.secondary} onClick={() => { void signOut().then(() => window.location.reload()) }}>Usar outra conta</button>
            </div>}
          </>)}
    </div>
  </section>
}
