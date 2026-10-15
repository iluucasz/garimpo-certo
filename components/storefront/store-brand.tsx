import Image from 'next/image'
import Link from 'next/link'
import styles from './storefront.module.css'

/** Logo do Garimpou Certo (public/logo-garimpou-21527f95.png, recortada da logo original). O nome acessível fica no link. */
export function StoreBrand() {
  return <Link href="/" className={styles.brand} aria-label="Garimpo certo, página inicial">
    <Image className={styles.brandLogo} src="/logo-garimpou-21527f95.png" alt="" width={427} height={176} priority sizes="(max-width: 720px) 110px, 140px"/>
  </Link>
}
