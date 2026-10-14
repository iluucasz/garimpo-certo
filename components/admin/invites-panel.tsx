'use client'

import { FormEvent, useState } from 'react'
import useSWR from 'swr'
import { Copy, MailPlus, XCircle } from 'lucide-react'
import { AdminApiError, adminFetch, dateTime, swrFetcher } from '@/lib/admin/client'
import { adminRoles, roleLabels, type AdminRole } from '@/lib/auth/rbac'
import { useAdminAccess } from './admin-access'
import styles from './resource.module.css'

type InviteRow = { id: string; email: string; roleCode: AdminRole; status: 'pending' | 'accepted' | 'expired' | 'revoked'; createdAt: string; expiresAt: string; invitedBy: string | null }
type InvitesData = { invites: InviteRow[]; ttlDays: number; emailEnabled: boolean }
type Created = { email: string; role: AdminRole; link: string; emailed: boolean; hasAccount: boolean }

const statusLabel: Record<InviteRow['status'], string> = { pending: 'Pendente', accepted: 'Aceito', expired: 'Vencido', revoked: 'Cancelado' }

/** Convite de pessoas para a equipe: gera o link (e envia por e-mail quando o envio está ativo). */
export function InvitesPanel() {
  const { permissions, roles } = useAdminAccess()
  const canManage = permissions.includes('users:manage')
  const isOwner = roles.includes('OWNER')
  const { data, error, mutate } = useSWR<InvitesData>('/api/v1/admin/invites', swrFetcher, { revalidateOnFocus: false })
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('MARKETING')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  if (!canManage) return null
  const allowedRoles = adminRoles.filter((item) => isOwner || (item !== 'OWNER' && item !== 'ADMIN'))

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    setFields({})
    setCopied(false)
    try {
      const result = await adminFetch<Created>('/api/v1/admin/invites', { method: 'POST', body: JSON.stringify({ email, role }) })
      setCreated(result)
      setEmail('')
      await mutate()
    } catch (reason) {
      if (reason instanceof AdminApiError) { setProblem(reason.message); setFields(reason.fields) } else setProblem('Não foi possível criar o convite.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('Cancelar este convite? O link deixa de funcionar.')) return
    try {
      await adminFetch(`/api/v1/admin/invites/${id}`, { method: 'DELETE' })
      await mutate()
    } catch (reason) {
      setProblem(reason instanceof AdminApiError ? reason.message : 'Não foi possível cancelar.')
    }
  }

  async function copy(link: string) {
    try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setCopied(false) }
  }

  const pending = data?.invites.filter((invite) => invite.status === 'pending').length ?? 0
  return <section className="panel" aria-labelledby="invites-title">
    <div className={styles.inviteBar}>
      <div>
        <h2 id="invites-title" style={{ marginBottom: 4 }}>Equipe</h2>
        <p className={styles.help}>Convide alguém com o papel certo: a pessoa abre o link e entra com o e-mail convidado. O convite vale por {data?.ttlDays ?? 7} dias.{pending > 0 ? ` ${pending} pendente${pending > 1 ? 's' : ''}.` : ''}</p>
      </div>
      <button type="button" className="btn primary" onClick={() => setFormOpen((open) => !open)} aria-expanded={formOpen}><MailPlus aria-hidden="true"/> {formOpen ? 'Fechar' : 'Convidar pessoa'}</button>
    </div>
    {data && !data.emailEnabled && formOpen && <p className={styles.help} style={{ marginTop: 10 }}>O envio por e-mail não está ativo: copie o link e envie você mesmo.</p>}

    {formOpen && <form onSubmit={create} className={styles.actionsRow} noValidate style={{ marginTop: 14 }}>
      <label className={styles.field} style={{ flex: '1 1 240px' }}>E-mail
        <input className={`input ${fields.email ? styles.inputError : ''}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pessoa@exemplo.com" required aria-invalid={fields.email ? true : undefined}/>
        {fields.email && <span className={styles.error} role="alert">{fields.email}</span>}
      </label>
      <label className={styles.field} style={{ flex: '0 1 220px' }}>Papel
        <select className="select" value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>
          {allowedRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
        </select>
        {fields.role && <span className={styles.error} role="alert">{fields.role}</span>}
      </label>
      <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}><MailPlus aria-hidden="true"/> {busy ? 'Criando…' : 'Gerar convite'}</button>
    </form>}
    {problem && <p className={styles.error} role="alert" style={{ marginTop: 10 }}>{problem}</p>}

    {created && <div className={styles.note} role="status" style={{ marginTop: 14, flexDirection: 'column' }}>
      <span><strong>Convite criado para {created.email}</strong> ({roleLabels[created.role]}). {created.emailed ? 'Enviamos o link por e-mail.' : 'Envie este link à pessoa: ele aparece só agora.'}{created.hasAccount ? ' Essa pessoa já tem conta; basta entrar e aceitar.' : ''}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ overflowWrap: 'anywhere' }}>{created.link}</code>
        <button type="button" className="btn secondary" onClick={() => copy(created.link)}><Copy aria-hidden="true"/> {copied ? 'Copiado' : 'Copiar link'}</button>
      </span>
    </div>}

    {error && <p className={styles.error} role="alert">Não foi possível carregar os convites.</p>}
    {data && data.invites.length > 0 && <h3 style={{ margin: '22px 0 8px', fontSize: 16 }}>Convites recentes</h3>}
    {data && data.invites.length > 0 && <div className="table-scroll"><table className="data-table" aria-label="Convites recentes">
      <thead><tr><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col">Situação</th><th scope="col">Criado em</th><th scope="col">Por</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
      <tbody>{data.invites.map((invite) => <tr key={invite.id}>
        <td>{invite.email}</td><td>{roleLabels[invite.roleCode] ?? invite.roleCode}</td><td>{statusLabel[invite.status]}</td>
        <td>{dateTime(invite.createdAt)}</td><td>{invite.invitedBy ?? '—'}</td>
        <td>{invite.status === 'pending' && <button type="button" className="btn secondary" onClick={() => revoke(invite.id)} aria-label={`Cancelar convite de ${invite.email}`}><XCircle aria-hidden="true"/> Cancelar</button>}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>
}
