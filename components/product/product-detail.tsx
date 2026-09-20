'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, GitCompareArrows, Heart, ShieldCheck, Star, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice, formatSoldCount } from '@/lib/mock-data'
import { generateRecommendations } from '@/lib/recommendation/engine'
import type { Product } from '@/lib/types'
import { ProductGrid } from './product-card'

export function ProductDetail({ product }: { product: Product }) {
  const { favorites, compare, toggleFavorite, toggleCompare, addRecent } = useMock()
  const { products, offers: allOffers, metrics, getOffers: getOffersForProduct, getBestOffer, getProvider } = useStoreData()
  const [imageIndex, setImageIndex] = useState(0)
  const offers = getOffersForProduct(product.id)
  const bestOffer = getBestOffer(product.id)
  const bestProvider = bestOffer ? getProvider(bestOffer.providerId) : null
  const alternativeOffers = offers.filter((offer) => offer.id !== bestOffer?.id)
  const previousPrice = bestOffer?.previousPrice ?? bestOffer?.price ?? 0
  const saving = bestOffer ? Math.max(0, previousPrice - bestOffer.price) : 0
  const total = bestOffer ? bestOffer.price + bestOffer.shipping : 0
  const min = Math.min(...product.priceHistory.map((point) => point.price))
  const max = Math.max(...product.priceHistory.map((point) => point.price))
  const gallery = product.images.length ? product.images : [product.image]
  const recommendations = useMemo(() => {
    const ids = generateRecommendations({ productId: product.id, category: product.category, limit: 4, seed: product.slug }, { products, offers: allOffers, metrics }).recommendations.map((item) => item.product.id)
    const sameCategory = products.filter((item) => ids.includes(item.id))
    return [...sameCategory, ...products.filter((item) => item.id !== product.id && !ids.includes(item.id))].slice(0, 4)
  }, [product.id, product.category, product.slug, products, allOffers, metrics])

  useEffect(() => addRecent(product.id), [product.id, addRecent])

  return <>
    <section className="container product-hero-section">
      <nav className="breadcrumbs" aria-label="Navegação estrutural"><Link href="/">Início</Link><span>/</span><Link href={`/categorias/${product.category}`}>{product.category}</Link><span>/</span><span>{product.name}</span></nav>
      <div className="product-detail">
        <div className="product-gallery">
          <div className="gallery-main"><Image src={gallery[imageIndex]} alt={`${product.name}, visual ${imageIndex + 1}`} fill priority sizes="(max-width: 900px) 100vw, 50vw" /></div>
          <div className="gallery-thumbs" aria-label="Galeria de imagens">{gallery.map((image, index) => <button type="button" key={`${image}-${index}`} className={imageIndex === index ? 'active' : ''} onClick={() => setImageIndex(index)} aria-label={`Mostrar visual ${index + 1}`} aria-pressed={imageIndex === index}><Image src={image} alt="" fill sizes="88px" /></button>)}</div>
        </div>
        <div className="pdp-copy">
          <div className="eyebrow">{product.brand}</div>
          <h1>{product.name}</h1>
          <p className="pdp-rating"><span><Star fill="currentColor" /> {product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>{bestOffer?.soldCount ? <span title="Vendas informadas pela Shopee no programa de afiliados. O anúncio na loja pode exibir um total acumulado maior.">{formatSoldCount(bestOffer.soldCount)}</span> : null}</p>
          <p className="pdp-description">{product.longDescription}</p>
          {bestOffer && bestProvider && <div className="primary-offer-card">
            <div className="primary-offer-heading"><div><span className="offer-kicker">MELHOR OFERTA ENCONTRADA</span><h2>{bestProvider.name}</h2></div><span className="verified-store"><CheckCircle2 /> Loja verificada</span></div>
            <div className="primary-offer-price"><div><s>{previousPrice > bestOffer.price ? formatPrice(previousPrice) : '\u00a0'}</s>{bestOffer.priceMax && bestOffer.priceMax > bestOffer.price ? <span className="price-from">a partir de</span> : null}<strong>{formatPrice(bestOffer.price)}</strong>{saving > 0 && <span>Economize {formatPrice(saving)}</span>}</div><div className="primary-offer-details"><span><Truck /> Frete calculado na Shopee</span>{bestOffer.soldCount ? <span>{formatSoldCount(bestOffer.soldCount)}</span> : null}<span>{bestOffer.stock} · atualizado {bestOffer.updatedAt}</span></div></div>
            <a className="btn primary primary-buy-button" href={bestOffer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar na {bestProvider.name}<ExternalLink /></a>
            <small className="total-note">{bestOffer.priceMax && bestOffer.priceMax > bestOffer.price ? <>Preço de <strong>{formatPrice(bestOffer.price)}</strong> a <strong>{formatPrice(bestOffer.priceMax)}</strong>, conforme a variação escolhida na Shopee.</> : <>Preço de <strong>{formatPrice(total)}</strong> na última sincronização com a Shopee.</>} Preço, frete e estoque podem mudar lá.</small>
          </div>}
          <div className="pdp-actions"><button type="button" className="btn secondary" onClick={() => toggleFavorite(product.id)}><Heart fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /> {favorites.includes(product.id) ? 'Favoritado' : 'Favoritar'}</button><button type="button" className="btn secondary" onClick={() => toggleCompare(product.id)}><GitCompareArrows /> {compare.includes(product.id) ? 'No comparador' : 'Comparar'}</button></div>
          <div className="pdp-confidence"><span className="score-number">{product.score}</span><div><strong>Índice Garimpo</strong><small>Avaliação, volume de vendas e desconto reunidos em uma nota de 0 a 100</small></div><ShieldCheck /></div>
        </div>
      </div>
    </section>

    <section className="container offer-comparison-section" aria-labelledby="outras-ofertas">
      {alternativeOffers.length > 0 && <div className="offer-section-heading"><div><div className="kicker">COMPARE ANTES DE COMPRAR</div><h2 id="outras-ofertas">Outras {alternativeOffers.length} ofertas</h2><p>Ordenadas pelo menor preço encontrado.</p></div><span className="best-offer-reminder">Melhor oferta: <strong>{bestProvider?.name}</strong></span></div>}
      <div className="offer-list">{alternativeOffers.map((offer) => { const provider = getProvider(offer.providerId); const offerTotal = offer.price + offer.shipping; return <article className="offer-row" key={offer.id}><div className="offer-store"><strong>{provider.name}</strong><span>{provider.verified && <CheckCircle2 />} {offer.stock} · atualizado {offer.updatedAt}</span></div><div className="offer-cost"><strong>{formatPrice(offer.price)}</strong><span>{offer.soldCount ? formatSoldCount(offer.soldCount) : 'oferta do parceiro'}</span><small>{formatPrice(offerTotal)} + frete</small></div><a className="btn secondary" href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Ver oferta<ExternalLink /></a></article>})}</div>
      <p className="affiliate-note"><ShieldCheck /><span><strong>Transparência primeiro.</strong> Podemos receber comissão quando uma compra ocorre pelo link parceiro, sem alterar o preço para você.</span></p>
    </section>

    {Object.keys(product.specs).length > 0 && <section className="tinted section"><div className="container"><div className="section-heading"><div><div className="kicker">FICHA RÁPIDA</div><h2>O que realmente importa</h2></div></div><div className="spec-grid">{Object.entries(product.specs).map(([key, value]) => <div key={key}><small>{key}</small><strong>{value}</strong></div>)}</div></div></section>}

    {product.priceHistory.length > 1 && <section className="container section"><div className="section-heading"><div><div className="kicker">HISTÓRICO DE PREÇO</div><h2>Preço acompanhado pelo Garimpo</h2><p>Menor preço registrado desde que passamos a acompanhar esta oferta: {formatPrice(min)}.</p></div></div><div className="chart">{product.priceHistory.map((point) => <div className="chart-col" key={point.month}><strong>{formatPrice(point.price)}</strong><div className="chart-bar" style={{ height: `${65 + ((point.price - min) / (max - min || 1)) * 90}px` }} /><span>{point.month}</span></div>)}</div></section>}
    <section className="container section related-products-section"><div className="section-heading"><div><div className="kicker">PRODUTOS RELACIONADOS</div><h2>Você também pode gostar</h2><p>Escolhas próximas em categoria, faixa de preço e interesse.</p></div></div><ProductGrid items={recommendations} /></section>
  </>
}
