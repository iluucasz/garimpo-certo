'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import styles from './content.module.css'

/** Copia o código do cupom. Se a área de transferência estiver bloqueada, o código continua visível para copiar à mão. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }
  return <button type="button" className={styles.copy} onClick={copy} aria-live="polite">
    {copied ? <Check aria-hidden="true" size={18}/> : <Copy aria-hidden="true" size={18}/>}{copied ? 'Copiado' : 'Copiar'}
  </button>
}
