'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useRef, useState } from 'react'
import { GitCompareArrows, Heart, Menu, Search, X } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { AccountMenu } from './account-menu'
import { StoreBrand } from './store-brand'
import styles from './storefront.module.css'

export function SiteHeader() {
  const router = useRouter()
  const { favorites, compare } = useMock()
  const { categories } = useStoreData()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (query.trim()) { setOpen(false); router.push(`/buscar?q=${encodeURIComponent(query.trim())}`) }
  }
  const closeMenu = () => setOpen(false)

  return <>
    <aside className={styles.notice} aria-label="Ambiente demonstrativo">Uma vitrine para explorar. <span>Preços e avaliações demonstrativos.</span></aside>
    <header className={styles.header}>
      <div className={`${styles.headerMain} container`}>
        <StoreBrand/>
        <form onSubmit={submit} className={styles.search} role="search"><Search aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Qual vai ser o seu próximo achado?" aria-label="Buscar produtos"/><button type="submit" aria-label="Enviar busca"><ArrowSearch/></button></form>
        <div className={styles.headerActions}>
          <Link href="/comparar" aria-label={`${compare.length} produtos no comparador`}><GitCompareArrows aria-hidden="true"/>{compare.length > 0 && <span aria-hidden="true">{compare.length}</span>}</Link>
          <Link href="/favoritos" aria-label={`${favorites.length} favoritos`}><Heart aria-hidden="true"/>{favorites.length > 0 && <span aria-hidden="true">{favorites.length > 99 ? '99+' : favorites.length}</span>}</Link>
          <AccountMenu/>
          <button ref={menuButton} type="button" onClick={() => setOpen((current) => !current)} className={styles.menuButton} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="store-navigation">{open ? <X/> : <Menu/>}</button>
        </div>
      </div>
      <div id="store-navigation" className={`${styles.navRow} ${open ? styles.navOpen : ''}`} onKeyDown={(event) => { if (event.key === 'Escape') { closeMenu(); menuButton.current?.focus() } }}>
        <div className={`container ${styles.navInner}`}>
          <nav className={styles.mainNav} aria-label="Navegação principal"><Link href="/buscar" onClick={closeMenu}>Todos os achados</Link>{categories.map((category) => <Link href={`/categorias/${category.slug}`} key={category.id} onClick={closeMenu}>{category.name}</Link>)}</nav>
          <nav className={styles.editorialNav} aria-label="Coleções e guias"><Link href="/#colecoes" onClick={closeMenu}>Coleções</Link><Link href="/guias" onClick={closeMenu}>Guias de compra</Link></nav>
        </div>
      </div>
    </header>
  </>
}

function ArrowSearch() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
}
