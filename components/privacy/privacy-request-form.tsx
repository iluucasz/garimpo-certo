'use client'

import { FormEvent, useState } from 'react'
import { Check, Send } from 'lucide-react'
import { MESSAGE_MAX, privacyRequestOptions } from '@/lib/privacy/requests'
import styles from '@/components/storefront/content-pages.module.css'

type Errors = Record<string, string>

/** Formulário público de pedido de titular (LGPD): cai na fila do painel, sem exigir conta. */
export function PrivacyRequestForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [type, setType] = useState('access')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [problem, setProblem] = useState('')
  const [protocol, setProtocol] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setProblem('')
    try {
      const response = await fetch('/api/v1/privacy-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, type, message, website }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (body?.error?.details && typeof body.error.details === 'object') setErrors(body.error.details as Errors)
        setProblem(body?.error?.message ?? 'Não foi possível enviar agora. Tente de novo em instantes.')
        return
      }
      setProtocol(String(body.data.protocol))
      setMessage('')
    } catch {
      setProblem('Sem conexão. Verifique a internet e tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  if (protocol) {
    return <div className={styles.success} role="status">
      <Check aria-hidden="true"/>
      <span><strong>Pedido recebido.</strong> Seu protocolo é <code>{protocol}</code>. Respondemos pelo e-mail informado em até 15 dias, como a LGPD prevê. Guarde o protocolo para consultas.</span>
    </div>
  }

  return <form className={styles.form} onSubmit={submit} noValidate aria-label="Pedido sobre dados pessoais">
    <label className={styles.field}>E-mail para a resposta
      <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? 'pr-email-error' : undefined} required/>
      {errors.email && <span id="pr-email-error" className={styles.fieldError} role="alert">{errors.email}</span>}
    </label>
    <label className={styles.field}>O que você precisa
      <select value={type} onChange={(event) => setType(event.target.value)}>
        {privacyRequestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {errors.type && <span className={styles.fieldError} role="alert">{errors.type}</span>}
    </label>
    <label className={styles.field}>Detalhes do pedido
      <textarea rows={5} maxLength={MESSAGE_MAX} value={message} onChange={(event) => setMessage(event.target.value)} aria-invalid={errors.message ? true : undefined} aria-describedby={errors.message ? 'pr-message-error' : undefined} required/>
      {errors.message && <span id="pr-message-error" className={styles.fieldError} role="alert">{errors.message}</span>}
      <small className={styles.fieldHint}>{message.length}/{MESSAGE_MAX}. Não envie senhas nem documentos neste campo.</small>
    </label>
    {/* Campo-armadilha para robôs: fora da tela e do teclado, nunca preenchido por pessoas. */}
    <div className={styles.trap} aria-hidden="true">
      <label>Deixe em branco<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)}/></label>
    </div>
    {problem && <p className={styles.error} role="alert">{problem}</p>}
    <button className={styles.submit} type="submit" disabled={busy} aria-busy={busy}><Send aria-hidden="true"/>{busy ? 'Enviando…' : 'Enviar pedido'}</button>
  </form>
}
