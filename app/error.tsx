'use client'

import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import styles from '@/components/storefront/content-pages.module.css'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StorefrontShell>
    <section className={styles.status} role="alert">
      <div>
        <h1>Não conseguimos carregar esta página.</h1>
        <p>Algo deu errado. Tente de novo.</p>
        <div className={styles.statusActions}>
          <button type="button" className={styles.statusPrimary} onClick={reset}>Tentar novamente</button>
          <Link className={styles.statusSecondary} href="/">Voltar ao início</Link>
        </div>
      </div>
    </section>
  </StorefrontShell>
}
