'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStoreData } from '@/components/store-data-provider'
import styles from './home.module.css'

/** Faixa horizontal de categorias com setas: rola de verdade com o mouse, sem depender de barra de rolagem. */
export function CategoryRail() {
  const { products, categories } = useStoreData()
  const list = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: true })

  const stats = useMemo(() => {
    const byCategory = new Map<string, { count: number; image?: string }>()
    for (const product of products) {
      const entry = byCategory.get(product.category) ?? { count: 0 }
      entry.count += 1
      entry.image ??= product.image
      byCategory.set(product.category, entry)
    }
    return byCategory
  }, [products])

  const update = useCallback(() => {
    const element = list.current
    if (!element) return
    const start = element.scrollLeft <= 2
    const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2
    setEdge((current) => (current.start === start && current.end === end ? current : { start, end }))
  }, [])

  useEffect(() => {
    const element = list.current
    if (!element) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [update, categories])

  function go(direction: 1 | -1) {
    const element = list.current
    if (!element) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollBy({ left: direction * element.clientWidth * 0.75, behavior: reduce ? 'auto' : 'smooth' })
  }

  return <section className={`${styles.categories} container`} id="categorias" aria-labelledby="home-categories-title">
    <div className={styles.categoryIntro}>
      <h2 id="home-categories-title">Por onde começamos?</h2>
      <Link href="/buscar">Todo o catálogo <ArrowRight aria-hidden="true"/></Link>
    </div>
    <div className={styles.rail} data-start={edge.start} data-end={edge.end}>
      <button type="button" className={`${styles.railButton} ${styles.railPrev}`} onClick={() => go(-1)} disabled={edge.start} aria-label="Ver categorias anteriores"><ChevronLeft aria-hidden="true"/></button>
      <div className={styles.categoryList} ref={list} onScroll={update}>
        {categories.map((category) => {
          const info = stats.get(category.slug)
          const count = info?.count ?? 0
          return <Link href={`/categorias/${category.slug}`} className={styles.category} key={category.id}>
            <span className={styles.categoryImage}><Image src={info?.image ?? '/placeholder.jpg'} alt="" fill sizes="52px"/></span>
            <span className={styles.categoryText}><strong>{category.name}</strong><span>{count} {count === 1 ? 'produto' : 'produtos'}</span></span>
          </Link>
        })}
      </div>
      <button type="button" className={`${styles.railButton} ${styles.railNext}`} onClick={() => go(1)} disabled={edge.end} aria-label="Ver mais categorias"><ChevronRight aria-hidden="true"/></button>
    </div>
  </section>
}
