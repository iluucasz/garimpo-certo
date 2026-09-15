'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Star } from 'lucide-react'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice, formatSoldCount } from '@/lib/mock-data'
import styles from './featured-products.module.css'

export function FeaturedProducts() {
  const { products, getBestOffer, getProvider } = useStoreData()
  const featured = [...products].filter((product) => getBestOffer(product.id)).sort((a, b) => b.score - a.score).slice(0, 4)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPlaying(!motion.matches)
    const onMotion = () => setPlaying(!motion.matches)
    const onVisibility = () => setVisible(document.visibilityState === 'visible')
    motion.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      motion.removeEventListener('change', onMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!playing || hovered || !visible || featured.length < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % featured.length), 6500)
    return () => window.clearInterval(timer)
  }, [playing, hovered, visible, featured.length])

  const product = featured[index % featured.length]
  if (!product) return null
  const offer = getBestOffer(product.id)!
  const provider = getProvider(offer.providerId)
  const discount = offer.previousPrice && offer.previousPrice > offer.price ? Math.round((1 - offer.price / offer.previousPrice) * 100) : 0
  const select = (next: number) => { setPlaying(false); setIndex((next + featured.length) % featured.length) }

  return <section className={styles.featured} aria-label="Produtos em destaque" aria-roledescription="carrossel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest('[data-carousel-rotation]')) setPlaying(false) }}>
    <div className={styles.top}><span>PRODUTOS EM DESTAQUE</span>{featured.length > 1 && <button type="button" data-carousel-rotation aria-label={playing ? 'Pausar destaques' : 'Reproduzir destaques'} onClick={() => setPlaying((current) => !current)}>{playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</button>}</div>
    <div className={styles.slide} aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
      <Link className={styles.slideLink} href={`/produto/${product.slug}`} aria-label={`Ver detalhes de ${product.name}`}/>
      <div className={styles.image}>
        <Image key={product.id} src={product.image} alt={product.name} fill sizes="(max-width: 700px) 90vw, 320px" preload={index === 0}/>
        {discount > 0 && <span className={styles.discount}>{discount}% OFF</span>}
      </div>
      <div className={styles.copy}>
        <span className={styles.brand}>{product.brand}</span>
        <h2>{product.name}</h2>
        <span className={styles.rating}><Star fill="currentColor" aria-hidden="true"/>{product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}<span>({product.reviews.toLocaleString('pt-BR')} avaliações)</span>{offer.soldCount ? <span className={styles.sold}>{formatSoldCount(offer.soldCount)}</span> : null}</span>
        <div className={styles.price}>{offer.previousPrice && offer.previousPrice > offer.price && <s>{formatPrice(offer.previousPrice)}</s>}<strong>{formatPrice(offer.price)}</strong></div>
        <span className={styles.provider}>{provider ? `na ${provider.name}` : 'na loja parceira'}{offer.shipping === 0 ? ' · Frete grátis' : ''}</span>
        <a className={styles.buy} href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar agora <ArrowUpRight aria-hidden="true"/></a>
      </div>
    </div>
    {featured.length > 1 && <div className={styles.controls}><div className={styles.dots}>{featured.map((item, position) => <button key={item.id} type="button" aria-label={`Mostrar destaque ${position + 1}: ${item.name}`} aria-pressed={position === index % featured.length} onClick={() => select(position)}/>)}</div><div className={styles.arrows}><span>{index % featured.length + 1} / {featured.length}</span><button type="button" aria-label="Destaque anterior" onClick={() => select(index - 1)}><ChevronLeft aria-hidden="true"/></button><button type="button" aria-label="Próximo destaque" onClick={() => select(index + 1)}><ChevronRight aria-hidden="true"/></button></div></div>}
  </section>
}
