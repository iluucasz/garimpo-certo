'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, GitCompareArrows, Heart, Star } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice } from '@/lib/mock-data'
import type { Product } from '@/lib/types'

export function ProductCard({ product }: { product: Product }) {
  const { favorites, compare, toggleFavorite, toggleCompare } = useMock()
  const { getBestOffer, getProvider } = useStoreData()
  const offer = getBestOffer(product.id)
  const price = offer?.price ?? 0
  const previous = offer?.previousPrice ?? product.priceHistory[0]?.price ?? price
  const discount = previous > price ? Math.round((1 - price / previous) * 100) : 0
  const saving = Math.max(0, previous - price)
  const provider = offer ? getProvider(offer.providerId) : null
  const isFavorite = favorites.includes(product.id)
  const isCompared = compare.includes(product.id)

  return <article className="product-card">
    <Link className="product-card-link" href={`/produto/${product.slug}`} aria-label={`Ver detalhes de ${product.name}`} />
    <div className="product-image">
      <Image src={product.image} alt={product.name} fill sizes="(max-width: 560px) 50vw, (max-width: 1000px) 33vw, 25vw" />
      <button type="button" onClick={() => toggleFavorite(product.id)} className={isFavorite ? 'icon-btn active product-card-action' : 'icon-btn product-card-action'} aria-label={isFavorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}><Heart fill={isFavorite ? 'currentColor' : 'none'} /></button>
      {discount > 0 && <span className="discount-badge">-{discount}%</span>}
      <span className="product-badge">{product.tags[0]}</span>
    </div>
    <div className="product-info">
      <div className="product-card-meta"><span>{product.brand}</span><span className="rating"><Star fill="currentColor" /> {product.rating} <small>({product.reviews.toLocaleString('pt-BR')})</small></span></div>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <div className="product-price-block">
        <s>{previous > price ? formatPrice(previous) : '\u00a0'}</s>
        <div><strong>{formatPrice(price)}</strong>{saving > 0 && <small>Economize {formatPrice(saving)}</small>}</div>
      </div>
      {provider && offer && <div className="product-offer-source"><span>Melhor oferta na <strong>{provider.name}</strong></span><small>{offer.shipping === 0 ? 'Frete grátis' : `+ ${formatPrice(offer.shipping)} de frete`}</small></div>}
      <div className="product-card-footer">
        {offer && provider && <a className="product-buy-button product-card-action" href={offer.url} target="_blank" rel="sponsored noopener noreferrer" aria-label={`Comprar ${product.name} na ${provider.name}`}><span>Comprar</span><ExternalLink /></a>}
        <button type="button" onClick={() => toggleCompare(product.id)} className={isCompared ? 'compare active product-card-action' : 'compare product-card-action'} aria-label={`${isCompared ? 'Remover' : 'Adicionar'} ${product.name} ${isCompared ? 'do' : 'ao'} comparador`}><GitCompareArrows /><span>{isCompared ? 'Adicionado' : 'Comparar'}</span></button>
      </div>
    </div>
  </article>
}

export function ProductGrid({ items }: { items: Product[] }) { return <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div> }
