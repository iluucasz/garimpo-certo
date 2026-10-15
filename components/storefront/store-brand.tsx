import Image from 'next/image'
import Link from 'next/link'
import styles from './storefront.module.css'

/** Logo do Garimpou Certo (public/logo-garimpou-92eb215e.png, recortada da logo original). O nome acessível fica no link. */
export function StoreBrand() {
  return <Link href="/" className={styles.brand} aria-label="Garimpo certo, página inicial">
    <Image className={styles.brandLogo} src="/logo-garimpou-92eb215e.png" alt="" width={434} height={176} priority sizes="(max-width: 720px) 110px, 140px"/>
  </Link>
}
