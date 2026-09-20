'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, GitCompareArrows, Heart, Star } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice, formatSoldCount } from '@/lib/mock-data'
import type { Product } from '@/lib/types'

export function ProductCard({ product }: { product: Product }) {
  const { favorites, compare, toggleFavorite, toggleCompare } = useMock()
  const { getBestOffer, getProvider } = useStoreData()
  const offer = getBestOffer(product.id)
  const previous = offer?.previousPrice ?? offer?.price ?? 0
  const discount = offer && previous > offer.price ? Math.round((1 - offer.price / previous) * 100) : 0
  const provider = offer ? getProvider(offer.providerId) : null
  const isFavorite = favorites.includes(product.id)
  const isCompared = compare.includes(product.id)

  return <article className="product-card">
    <Link className="product-card-link" href={`/produto/${product.slug}`} aria-label={`Ver detalhes de ${product.name}`}/>
    <div className="product-image">
      <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw"/>
      <button type="button" onClick={() => toggleFavorite(product.id)} className={isFavorite ? 'icon-btn active product-card-action' : 'icon-btn product-card-action'} aria-pressed={isFavorite} aria-label={isFavorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}><Heart fill={isFavorite ? 'currentColor' : 'none'}/></button>
      {discount > 0 && <span className="discount-badge">−{discount}%</span>}
    </div>
    <div className="product-info">
      <div className="product-card-meta"><span>{product.brand}</span><div className="product-stats"><span className="product-rating"><Star fill="currentColor" aria-hidden="true"/>{product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}<span className="sr-only">de 5 estrelas</span></span>{product.reviews > 0 ? <span>({product.reviews.toLocaleString('pt-BR')} avaliações)</span> : null}{offer?.soldCount ? <span className="product-sold-count">{formatSoldCount(offer.soldCount)}</span> : null}</div></div>
      <h3>{product.name}</h3>
      <div className="product-price-block">{offer ? <div>{offer.priceMax && offer.priceMax > offer.price ? <span className="price-from">a partir de</span> : null}<strong>{formatPrice(offer.price)}</strong>{previous > offer.price && <s>{formatPrice(previous)}</s>}</div> : <span className="unavailable-offer">Sem oferta disponível</span>}</div>
      {provider && <div className="product-offer-source"><span>na {provider.name}</span></div>}
      <div className="product-card-footer">
        {offer ? <a className="product-buy-button product-card-action" href={offer.url} target="_blank" rel="sponsored noopener noreferrer" aria-label={`Comprar ${product.name}${provider ? ` na ${provider.name}` : ''}`}><span>Comprar agora</span><ArrowUpRight aria-hidden="true"/></a> : <Link className="product-buy-button product-card-action" href={`/produto/${product.slug}`}>Ver produto <ArrowUpRight aria-hidden="true"/></Link>}
      </div>
      <div className="product-card-secondary">
        <button type="button" onClick={() => toggleCompare(product.id)} className={isCompared ? 'compare active product-card-action' : 'compare product-card-action'} aria-pressed={isCompared} aria-label={`${isCompared ? 'Remover' : 'Adicionar'} ${product.name} ${isCompared ? 'do' : 'ao'} comparador`}><GitCompareArrows aria-hidden="true"/><span>{isCompared ? 'Adicionado' : 'Comparar'}</span></button>
      </div>
    </div>
  </article>
}

export function ProductGrid({ items }: { items: Product[] }) {
  return <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
}
