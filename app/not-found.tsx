import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import styles from '@/components/storefront/content-pages.module.css'

export default function NotFound() {
  return <StorefrontShell>
    <section className={styles.status}>
      <div>
        <span className={styles.statusCode} data-code="404" aria-hidden="true"/>
        <h1>Essa página saiu do mapa.</h1>
        <p>Esta página não existe mais.</p>
        <div className={styles.statusActions}>
          <Link className={styles.statusPrimary} href="/">Voltar ao início</Link>
          <Link className={styles.statusSecondary} href="/buscar">Buscar no catálogo</Link>
        </div>
      </div>
    </section>
  </StorefrontShell>
}
