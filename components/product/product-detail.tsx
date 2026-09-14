'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, GitCompareArrows, Heart, ShieldCheck, Star, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice } from '@/lib/mock-data'
import { generateRecommendations } from '@/lib/recommendation/engine'
import type { Product } from '@/lib/types'
import { ProductGrid } from './product-card'

const reviewDistribution = [72, 18, 6, 3, 1]

export function ProductDetail({ product }: { product: Product }) {
  const { favorites, compare, toggleFavorite, toggleCompare, addRecent } = useMock()
  const { products, offers: allOffers, getOffers: getOffersForProduct, getBestOffer, getProvider } = useStoreData()
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
    const ids = generateRecommendations({ productId: product.id, category: product.category, limit: 4, seed: product.slug }, { products, offers: allOffers }).recommendations.map((item) => item.product.id)
    const sameCategory = products.filter((item) => ids.includes(item.id))
    return [...sameCategory, ...products.filter((item) => item.id !== product.id && !ids.includes(item.id))].slice(0, 4)
  }, [product.id, product.category, product.slug, products, allOffers])
  const comments = useMemo(() => [
    { name: 'Camila R.', initials: 'CR', rating: 5, title: 'Cumpre muito bem o que promete', text: `O ${product.name} chegou bem embalado e a qualidade percebida é ótima. O uso no dia a dia é simples e o acabamento me surpreendeu.`, date: 'há 12 dias', verified: true },
    { name: 'Rafael M.', initials: 'RM', rating: 5, title: 'Boa escolha pelo preço', text: `Pesquisei bastante antes de escolher. Encontrei no ${bestProvider?.name ?? 'parceiro'} pelo melhor custo total e o produto atendeu minhas expectativas.`, date: 'há 3 semanas', verified: true },
    { name: 'Joana P.', initials: 'JP', rating: 4, title: 'Produto muito bom', text: `Gostei bastante do desempenho e do visual. Só senti falta de mais detalhes no manual, mas usaria o ${product.name} novamente sem dúvida.`, date: 'há 1 mês', verified: false },
  ], [product.name, bestProvider?.name])

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
          <div className="eyebrow">{product.brand} · DADOS DEMONSTRATIVOS</div>
          <h1>{product.name}</h1>
          <a className="pdp-rating" href="#avaliacoes" aria-label={`Ver avaliações: nota ${product.rating} de 5`}><span><Star fill="currentColor" /> {product.rating}</span><span>{product.reviews.toLocaleString('pt-BR')} avaliações simuladas</span></a>
          <p className="pdp-description">{product.longDescription}</p>
          {bestOffer && bestProvider && <div className="primary-offer-card">
            <div className="primary-offer-heading"><div><span className="offer-kicker">MELHOR CUSTO TOTAL</span><h2>{bestProvider.name}</h2></div><span className="verified-store"><CheckCircle2 /> Loja verificada</span></div>
            <div className="primary-offer-price"><div><s>{previousPrice > bestOffer.price ? formatPrice(previousPrice) : '\u00a0'}</s><strong>{formatPrice(bestOffer.price)}</strong>{saving > 0 && <span>Economize {formatPrice(saving)}</span>}</div><div className="primary-offer-details"><span><Truck /> {bestOffer.shipping === 0 ? 'Frete grátis' : `${formatPrice(bestOffer.shipping)} de frete`}</span><span>{bestOffer.installment}</span><span>{bestOffer.stock} · atualizado {bestOffer.updatedAt}</span></div></div>
            <a className="btn primary primary-buy-button" href={bestOffer.url} target="_blank" rel="sponsored noopener noreferrer">Comprar na {bestProvider.name}<ExternalLink /></a>
            <small className="total-note">Custo total: <strong>{formatPrice(total)}</strong>. Preço e estoque podem mudar no parceiro.</small>
          </div>}
          <div className="pdp-actions"><button type="button" className="btn secondary" onClick={() => toggleFavorite(product.id)}><Heart fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /> {favorites.includes(product.id) ? 'Favoritado' : 'Favoritar'}</button><button type="button" className="btn secondary" onClick={() => toggleCompare(product.id)}><GitCompareArrows /> {compare.includes(product.id) ? 'No comparador' : 'Comparar'}</button></div>
          <div className="pdp-confidence"><span className="score-number">{product.score}</span><div><strong>Índice Garimpo</strong><small>Qualidade, preço e confiança em uma nota demonstrativa</small></div><ShieldCheck /></div>
        </div>
      </div>
    </section>

    <section className="container offer-comparison-section" aria-labelledby="outras-ofertas">
      <div className="offer-section-heading"><div><div className="kicker">COMPARE ANTES DE COMPRAR</div><h2 id="outras-ofertas">Outras {alternativeOffers.length} ofertas</h2><p>Ordenadas por custo total, incluindo o frete informado.</p></div><span className="best-offer-reminder">Melhor oferta: <strong>{bestProvider?.name}</strong></span></div>
      <div className="offer-list">{alternativeOffers.map((offer) => { const provider = getProvider(offer.providerId); const offerTotal = offer.price + offer.shipping; return <article className="offer-row" key={offer.id}><div className="offer-store"><strong>{provider.name}</strong><span>{provider.verified && <CheckCircle2 />} {offer.stock} · atualizado {offer.updatedAt}</span></div><div className="offer-cost"><strong>{formatPrice(offer.price)}</strong><span>{offer.shipping === 0 ? 'Frete grátis' : `+ ${formatPrice(offer.shipping)} de frete`} · {offer.installment}</span><small>Total {formatPrice(offerTotal)}</small></div><a className="btn secondary" href={offer.url} target="_blank" rel="sponsored noopener noreferrer">Ver oferta<ExternalLink /></a></article>})}</div>
      <p className="affiliate-note"><ShieldCheck /><span><strong>Transparência primeiro.</strong> Podemos receber comissão quando uma compra ocorre pelo link parceiro, sem alterar o preço para você.</span></p>
    </section>

    <section className="tinted section"><div className="container"><div className="section-heading"><div><div className="kicker">FICHA RÁPIDA</div><h2>O que realmente importa</h2></div></div><div className="spec-grid">{Object.entries(product.specs).map(([key, value]) => <div key={key}><small>{key}</small><strong>{value}</strong></div>)}</div></div></section>

    <section className="container reviews-section" id="avaliacoes" aria-labelledby="titulo-avaliacoes">
      <div className="section-heading"><div><div className="kicker">AVALIAÇÕES DEMONSTRATIVAS</div><h2 id="titulo-avaliacoes">O que as pessoas acharam</h2><p>Comentários simulados para representar a futura experiência de avaliações verificadas.</p></div></div>
      <div className="reviews-layout">
        <aside className="review-summary"><div className="review-score"><strong>{product.rating}</strong><span aria-label={`${product.rating} de 5 estrelas`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} fill="currentColor" />)}</span><small>Baseado em {product.reviews.toLocaleString('pt-BR')} avaliações simuladas</small></div><div className="rating-bars">{reviewDistribution.map((percentage, index) => <div key={5 - index}><span>{5 - index}</span><Star fill="currentColor" /><div><i style={{ width: `${percentage}%` }} /></div><small>{percentage}%</small></div>)}</div></aside>
        <div className="review-list">{comments.map((comment) => <article className="review-card" key={comment.name}><header><span className="review-avatar" aria-hidden="true">{comment.initials}</span><div><strong>{comment.name}</strong><small>{comment.verified ? 'Compra simulada verificada' : 'Avaliação simulada'} · {comment.date}</small></div><span className="review-stars" aria-label={`${comment.rating} de 5 estrelas`}>{Array.from({ length: comment.rating }, (_, index) => <Star key={index} fill="currentColor" />)}</span></header><h3>{comment.title}</h3><p>{comment.text}</p></article>)}</div>
      </div>
    </section>

    <section className="container section"><div className="section-heading"><div><div className="kicker">HISTÓRICO ILUSTRATIVO</div><h2>Preço nos últimos 6 meses</h2><p>Menor preço observado: {formatPrice(min)}. Valores simulados.</p></div></div><div className="chart">{product.priceHistory.map((point) => <div className="chart-col" key={point.month}><strong>{formatPrice(point.price)}</strong><div className="chart-bar" style={{ height: `${65 + ((point.price - min) / (max - min || 1)) * 90}px` }} /><span>{point.month}</span></div>)}</div></section>
    <section className="container section related-products-section"><div className="section-heading"><div><div className="kicker">PRODUTOS RELACIONADOS</div><h2>Você também pode gostar</h2><p>Escolhas próximas em categoria, faixa de preço e interesse.</p></div></div><ProductGrid items={recommendations} /></section>
  </>
}
