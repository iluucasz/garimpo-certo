import Link from 'next/link'
import styles from './storefront.module.css'

export function StoreBrand() {
  return <Link href="/" className={styles.brand} aria-label="Garimpo certo, página inicial">
    <svg className={styles.brandMark} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#f26332"/>
      <path d="M26.2 13.8a9 9 0 1 0 .2 12.2V20h-6.7" stroke="white" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span className={styles.brandWord} aria-hidden="true"><span className={styles.brandName}>arimpo</span><span className={styles.brandTag}>certo</span></span>
  </Link>
}
