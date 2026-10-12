'use client'

import { useStoreData } from '@/components/store-data-provider'
import styles from './home.module.css'

export function HeroStat() {
  const { products, categories } = useStoreData()
  if (!products.length) return null
  return <p className={styles.heroStat}><span aria-hidden="true"/>{products.length} achados em {categories.length} categorias da Shopee</p>
}
