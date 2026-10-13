import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import styles from '@/components/storefront/content-pages.module.css'

export default function NotFound() {
  return <StorefrontShell>
    <section className={styles.status}>
      <div>
        <span className={styles.statusCode} aria-hidden="true">404</span>
        <h1>Essa página saiu do mapa.</h1>
        <p>O endereço pode ter mudado ou o produto já não está no catálogo. Procure pelo que você queria ou volte ao início.</p>
        <div className={styles.statusActions}>
          <Link className={styles.statusPrimary} href="/">Voltar ao início</Link>
          <Link className={styles.statusSecondary} href="/buscar">Buscar no catálogo</Link>
        </div>
      </div>
    </section>
  </StorefrontShell>
}
