'use client'

import Link from 'next/link'
import { ArrowUpRight, BadgePercent, Flame, Star, Wallet, type LucideIcon } from 'lucide-react'
import { useStoreData } from '@/components/store-data-provider'
import { currentPrice, matchesSignal } from '@/lib/catalog/signals'
import styles from './home.module.css'

type Shortcut = { icon: LucideIcon; title: string; hint: string; href: string; test: (price: number, has: (signal: string) => boolean) => boolean }
const shortcuts: Shortcut[] = [
  { icon: BadgePercent, title: 'Em promoção', hint: 'Com 20% ou mais abaixo do preço anterior', href: '/buscar?sinais=Em%20promo%C3%A7%C3%A3o', test: (_, has) => has('Em promoção') },
  { icon: Flame, title: 'Mais vendidos', hint: 'Mais de mil vendas recentes', href: '/buscar?sinais=Mais%20vendidos', test: (_, has) => has('Mais vendidos') },
  { icon: Star, title: 'Bem avaliados', hint: 'Nota 4,8 ou mais', href: '/buscar?sinais=Bem%20avaliados', test: (_, has) => has('Bem avaliados') },
  { icon: Wallet, title: 'Até R$ 50', hint: 'Preço atual de até R$ 50', href: '/buscar?precoMax=50', test: (price) => price <= 50 },
]

export function HomeSelections() {
  const { products, offers } = useStoreData()
  const tiles = shortcuts.map((shortcut) => {
    const items = products.filter((product) => shortcut.test(currentPrice(product, offers), (signal) => matchesSignal(signal, product, offers)))
    return { ...shortcut, items }
  }).filter((tile) => tile.items.length > 0)
  if (!tiles.length) return null

  return <section className={`${styles.selections} container`} id="selecoes" aria-labelledby="selections-title">
    <div className={styles.sectionHeading}><div><h2 id="selections-title">Escolha pelo que importa.</h2><p>Atalhos que filtram o catálogo por preço, nota e promoção.</p></div></div>
    <div className={styles.selectionGrid}>{tiles.map(({ icon: Icon, ...tile }) => <Link href={tile.href} className={styles.selection} key={tile.title}>
      <span className={styles.selectionIcon} aria-hidden="true"><Icon/></span>
      <span className={styles.selectionText}><strong>{tile.title}</strong><span>{tile.hint}</span><small>{tile.items.length} {tile.items.length === 1 ? 'produto' : 'produtos'}</small></span>
      <ArrowUpRight aria-hidden="true"/>
    </Link>)}</div>
  </section>
}
