'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, GitCompareArrows, Heart, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useVisitorState } from '@/components/visitor-state-provider'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice, formatSoldCount } from '@/lib/format'
import { generateRecommendations } from '@/lib/recommendation/engine'
import { rankingFromSettings } from '@/lib/recommendation/settings'
import type { Product } from '@/lib/types'
import { ProductGrid } from './product-card'
import styles from './product-detail.module.css'

/** O importador gera "Vendido por {loja} na Shopee." quando a API não traz descrição; repetir isso só duplica a linha do vendedor. */
const isGeneratedDescription = (text: string) => /^Vendido por .+ na Shopee\.?$/.test(text.trim())

export function ProductDetail({ product }: { product: Product }) {
  const { favorites, compare, toggleFavorite, toggleCompare, addRecent } = useVisitorState()
  const { products, categories, offers: allOffers, metrics, ranking, slots, getOffers: getOffersForProduct, getBestOffer, getProvider } = useStoreData()
  const similarEnabled = slots.similarEnabled !== false
  const similarLimit = Math.min(8, Math.max(1, Number(slots.similarLimit) || 4))
  const [imageIndex, setImageIndex] = useState(0)
  const [showBar, setShowBar] = useState(false)
  const buyButton = useRef<HTMLAnchorElement>(null)
  const offers = getOffersForProduct(product.id)
  const bestOffer = getBestOffer(product.id)
  const bestProvider = bestOffer ? getProvider(bestOffer.providerId) : null
  const alternativeOffers = offers.filter((offer) => offer.id !== bestOffer?.id)
  const previousPrice = bestOffer?.previousPrice ?? bestOffer?.price ?? 0
  const saving = bestOffer ? Math.max(0, previousPrice - bestOffer.price) : 0
  const discount = bestOffer && previousPrice > bestOffer.price ? Math.round((1 - bestOffer.price / previousPrice) * 100) : 0
  const hasRange = Boolean(bestOffer?.priceMax && bestOffer.priceMax > bestOffer.price)
  const prices = product.priceHistory.map((point) => point.price)
  const min = prices.length ? Math.min(...prices) : 0
  const max = prices.length ? Math.max(...prices) : 0
  const gallery = product.images.length ? product.images : [product.image]
  const categoryName = categories.find((category) => category.slug === product.category)?.name ?? product.category
  const specs = Object.entries(product.specs)
  const description = product.longDescription && !isGeneratedDescription(product.longDescription) ? product.longDescription : null
  const isFavorite = favorites.includes(product.id)
  const isCompared = compare.includes(product.id)
  const recommendations = useMemo(() => {
    if (!similarEnabled) return []
    const { weights, explorationRate } = rankingFromSettings(ranking)
    const ids = generateRecommendations({ productId: product.id, category: product.category, limit: similarLimit, seed: product.slug, weights, explorationRate }, { products, offers: allOffers, metrics }).recommendations.map((item) => item.product.id)
    const sameCategory = products.filter((item) => ids.includes(item.id))
    return [...sameCategory, ...products.filter((item) => item.id !== product.id && !ids.includes(item.id))].slice(0, similarLimit)
  }, [product.id, product.category, product.slug, products, allOffers, metrics, ranking, similarEnabled, similarLimit])

  useEffect(() => addRecent(product.id), [product.id, addRecent])

  // Barra de compra fixa no celular: só aparece depois que o botão principal saiu da tela.
  useEffect(() => {
    const element = buyButton.current
    if (!element) return
    let frame = 0
    const update = () => { frame = 0; setShowBar(element.getBoundingClientRect().bottom < 0) }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (frame) window.cancelAnimationFrame(frame) }
  }, [bestOffer?.id])

  // Reserva o espaço da barra fixa para ela não cobrir o rodapé.
  useEffect(() => {
    if (!showBar || !window.matchMedia('(max-width: 700px)').matches) return
    document.body.style.paddingBottom = '76px'
    return () => { document.body.style.paddingBottom = '' }
  }, [showBar])

  return <>
    <section className={`container ${styles.page}`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural"><Link href="/">Início</Link><span aria-hidden="true">/</span><Link href={`/categorias/${product.category}`}>{categoryName}</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
      <div className={styles.layout}>
        <div className={styles.gallery}>
          <div className={styles.mainImage}><Image src={gallery[imageIndex]} alt={`${product.name}, imagem ${imageIndex + 1} de ${gallery.length}`} fill preload quality={60} sizes="(max-width: 900px) 100vw, 50vw"/>{discount > 0 && <span className={styles.discount}>−{discount}%<span className="sr-only"> de desconto</span></span>}</div>
          {gallery.length > 1 && <div className={styles.thumbs} role="group" aria-label="Galeria de imagens">{gallery.map((image, index) => <button type="button" key={`${image}-${index}`} className={imageIndex === index ? styles.thumbActive : ''} onClick={() => setImageIndex(index)} aria-label={`Mostrar imagem ${index + 1}`} aria-pressed={imageIndex === index}><Image src={image} alt="" fill sizes="72px" fetchPriority="low"/></button>)}</div>}
        </div>

        <div className={styles.summary}>
          <p className={styles.seller}>Vendido por <strong>{product.brand}</strong></p>
          <h1>{product.name}</h1>
          <p className={styles.signals}>
            {product.rating > 0 && <span className={styles.stars}><Star fill="currentColor" aria-hidden="true"/>{product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}<span className="sr-only"> de 5 estrelas</span></span>}
            {product.reviews > 0 && <span>({product.reviews.toLocaleString('pt-BR')} avaliações)</span>}
            {bestOffer?.soldCount ? <span title="Vendas informadas pela Shopee no programa de afiliados. O anúncio na loja pode exibir um total acumulado maior.">{formatSoldCount(bestOffer.soldCount)}</span> : null}
          </p>
          {description && <p className={styles.description}>{description}</p>}

          {bestOffer && bestProvider && <div className={styles.buyBox}>
            <p className={styles.buyLabel}>{alternativeOffers.length > 0 ? 'Melhor oferta encontrada' : `Oferta na ${bestProvider.name}`}{bestProvider.verified && <span><BadgeCheck aria-hidden="true"/>Loja verificada</span>}</p>
            <div className={styles.priceRow}>
              {hasRange && <span className={styles.priceFrom}>a partir de</span>}
              <strong>{formatPrice(bestOffer.price)}</strong>
              {previousPrice > bestOffer.price && <s>{formatPrice(previousPrice)}</s>}
              {saving > 0 && <span className={styles.saving}>Economize {formatPrice(saving)}</span>}
            </div>
            {hasRange && <p className={styles.range}>até {formatPrice(bestOffer.priceMax!)} conforme a variação</p>}
            <a className={styles.buyButton} ref={buyButton} data-offer-id={bestOffer.id} data-slot="pdp-main" href={bestOffer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar na {bestProvider.name}<ArrowUpRight aria-hidden="true"/></a>
            <p className={styles.fine}>Link de afiliado · atualizado {bestOffer.updatedAt}</p>
          </div>}

          <div className={styles.actions}>
            <button type="button" onClick={() => toggleFavorite(product.id)} aria-pressed={isFavorite} className={isFavorite ? styles.actionActive : ''}><Heart fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true"/>{isFavorite ? 'Nos favoritos' : 'Favoritar'}</button>
            <button type="button" onClick={() => toggleCompare(product.id)} aria-pressed={isCompared} className={isCompared ? styles.actionActive : ''}><GitCompareArrows aria-hidden="true"/>{isCompared ? 'No comparador' : 'Comparar'}</button>
          </div>

          <div className={styles.index}>
            <span className={styles.indexScore} aria-label={`Índice Garimpo ${product.score} de 100`}>{product.score}</span>
            <div><strong title="Reúne avaliação, vendas e desconto em uma nota de 0 a 100.">Índice Garimpo</strong></div>
          </div>
        </div>
      </div>
    </section>

    {alternativeOffers.length > 0 && <section className={`container ${styles.section}`} aria-labelledby="outras-ofertas">
      <h2 id="outras-ofertas">Outras {alternativeOffers.length} ofertas</h2>
      <ul className={styles.offers}>{alternativeOffers.map((offer) => { const provider = getProvider(offer.providerId); const offerTotal = offer.price + offer.shipping; return <li className={styles.offer} key={offer.id}>
        <div><strong>{provider.name}</strong><span>{provider.verified && <BadgeCheck aria-hidden="true"/>}{offer.stock} · atualizado {offer.updatedAt}</span></div>
        <div className={styles.offerPrice}><strong>{formatPrice(offer.price)}</strong><span>{offer.shipping > 0 ? `${formatPrice(offerTotal)} com frete` : offer.soldCount ? formatSoldCount(offer.soldCount) : 'oferta do parceiro'}</span></div>
        <a data-offer-id={offer.id} data-slot="pdp-alternative" href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Ver oferta<ArrowUpRight aria-hidden="true"/></a>
      </li> })}</ul>
    </section>}

    {specs.length > 0 && <section className={styles.tinted}><div className={`container ${styles.section}`}><h2>Detalhes</h2><dl className={styles.specs}>{specs.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div></section>}

    {product.priceHistory.length > 1 && <section className={`container ${styles.section}`} aria-labelledby="historico-preco">
      <h2 id="historico-preco">Histórico de preço</h2>
      <p className={styles.sectionLead}>Menor preço registrado: {formatPrice(min)}</p>
      <ol className={styles.history}>{product.priceHistory.map((point) => <li key={point.month}><strong>{formatPrice(point.price)}</strong><span className={styles.bar} style={{ height: `${Math.max(8, Math.round((point.price / (max || 1)) * 120))}px` }} aria-hidden="true"/><span>{point.month}</span></li>)}</ol>
    </section>}

    {similarEnabled && recommendations.length > 0 && <section className={`container ${styles.section}`} aria-labelledby="relacionados">
      <h2 id="relacionados">Você também pode gostar</h2>
      <ProductGrid items={recommendations}/>
    </section>}

    {showBar && bestOffer && bestProvider && <div className={styles.stickyBar}>
      <div><strong>{formatPrice(bestOffer.price)}</strong><span>{hasRange ? 'a partir de · ' : ''}na {bestProvider.name}</span></div>
      <a data-offer-id={bestOffer.id} data-slot="pdp-sticky" href={bestOffer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar na {bestProvider.name}<ArrowUpRight aria-hidden="true"/></a>
    </div>}
  </>
}
