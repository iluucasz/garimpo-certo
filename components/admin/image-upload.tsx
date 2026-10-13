'use client'

import { useId, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { AdminApiError, adminFetch } from '@/lib/admin/client'
import { imageTypes, MAX_UPLOAD_BYTES } from '@/lib/storage/upload'
import styles from './resource.module.css'

/**
 * Envia uma imagem para o armazenamento do site e devolve o endereço. Fica ao lado do campo de URL:
 * a pessoa pode colar um endereço ou enviar o arquivo.
 */
export function ImageUpload({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (url: string) => void }) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function send(file: File) {
    setFailed(false)
    setMessage('')
    if (file.size > MAX_UPLOAD_BYTES) { setFailed(true); setMessage(`A imagem passa de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`); return }
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await adminFetch<{ url: string }>('/api/v1/admin/uploads', { method: 'POST', body })
      onChange(result.url)
      setMessage('Imagem enviada. Salve para aplicar.')
    } catch (reason) {
      setFailed(true)
      setMessage(reason instanceof AdminApiError ? reason.message : 'Não foi possível enviar a imagem.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return <div className={styles.upload}>
    {value && /^https?:\/\//i.test(value) && <img className={styles.uploadPreview} src={value} alt="Prévia da imagem atual" loading="lazy"/>}
    <div className={styles.actionsRow}>
      <input ref={input} id={inputId} type="file" accept={imageTypes.join(',')} hidden disabled={disabled || busy}
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void send(file) }}/>
      <button type="button" className="btn secondary" disabled={disabled || busy} onClick={() => input.current?.click()} aria-busy={busy}>
        {busy ? <Loader2 className="spin" aria-hidden="true"/> : <ImagePlus aria-hidden="true"/>} {busy ? 'Enviando…' : 'Enviar imagem'}
      </button>
      <span className={styles.help}>JPG, PNG, WebP, AVIF ou GIF, até {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.</span>
    </div>
    {message && <p className={failed ? styles.error : styles.help} role={failed ? 'alert' : 'status'}>{message}</p>}
  </div>
}
