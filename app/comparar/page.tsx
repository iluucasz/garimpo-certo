'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, GitCompareArrows, LockKeyhole, MoveHorizontal, Star, X } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { ContentSkeleton } from '@/components/storefront/store-loading'
import { EmptyCollection, PersonalHeading, SuggestedProducts } from '@/components/storefront/personal-page-parts'
import { formatPrice, formatSoldCount } from '@/lib/mock-data'
import styles from '@/components/storefront/personal-pages.module.css'

export default function ComparePage() {
  const { compare, toggleCompare, hydrated } = useMock()
  const { products, getBestOffer, getProvider } = useStoreData()
  if (!hydrated) return <StorefrontShell><ContentSkeleton variant="compare"/></StorefrontShell>
  const items = compare.flatMap((id) => { const product = products.find((item) => item.id === id); return product ? [product] : [] }).slice(0, 4)
  const available = products.filter((product) => !compare.includes(product.id))
  const offers = items.map((product) => getBestOffer(product.id))
  const lowest = Math.min(...offers.flatMap((offer) => offer ? [offer.price] : []))
  const specNames = [...new Set(items.flatMap((product) => Object.keys(product.specs)))]

  return <StorefrontShell><div className={`container ${styles.page}`}><PersonalHeading mode="compare"/>
    <div className={styles.toolbar}><p><strong>{items.length} de 4</strong> produtos no comparador</p><label htmlFor="add-compare-product">Adicionar produto<select id="add-compare-product" value="" disabled={items.length >= 4 || !available.length} onChange={(event) => { if (event.target.value && items.length < 4) toggleCompare(event.target.value) }}><option value="">{items.length >= 4 ? 'Limite de 4 produtos' : 'Escolha no catálogo'}</option>{available.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div>
    {items.length ? <>
      {items.length === 1 && <p className={styles.comparisonHint}><GitCompareArrows aria-hidden="true"/>Adicione mais um produto para comparar as diferenças.</p>}
      <p className={styles.mobileHint}><MoveHorizontal aria-hidden="true"/>Deslize a tabela para ver todos os produtos.</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tabela de comparação de produtos">
        <table className={styles.comparisonTable} style={{ minWidth: 160 + Math.max(items.length, 2) * 240 }}><caption className="sr-only">Comparação de preços e características dos produtos selecionados</caption><thead><tr><th scope="col"><span className={styles.tableLabel}><GitCompareArrows aria-hidden="true"/>Seus produtos,<br/>lado a lado.</span></th>{items.map((product) => <th scope="col" key={product.id}><div className={styles.productHeading}><button className={styles.removeProduct} type="button" aria-label={`Remover ${product.name} do comparador`} onClick={() => toggleCompare(product.id)}><X aria-hidden="true"/></button><Link href={`/produto/${product.slug}`}><div className={styles.productImage}><Image src={product.image} alt="" fill sizes="220px"/></div><small>{product.brand}</small><h2>{product.name}</h2></Link></div></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Preço do produto</th>{items.map((product, index) => { const offer = offers[index]; const provider = offer ? getProvider(offer.providerId) : null; return <td key={product.id}>{offer ? <><strong className={styles.price}>{formatPrice(offer.price)}</strong>{offer.priceMax && offer.priceMax > offer.price ? <span className={styles.storeName}>até {formatPrice(offer.priceMax)}, conforme a variação</span> : null}{provider && <span className={styles.storeName}>na {provider.name}</span>}{offers.filter(Boolean).length > 1 && offer.price === lowest && <span className={styles.lowest}>Menor preço da seleção</span>}</> : 'Sem oferta disponível'}</td> })}</tr>
          <tr><th scope="row">Avaliação e vendas</th>{items.map((product, index) => <td key={product.id}><span className={styles.rating}><Star fill="currentColor" aria-hidden="true"/>{product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} / 5</span>{offers[index]?.soldCount ? <span className={styles.reviewCount}>{formatSoldCount(offers[index]!.soldCount!)}</span> : null}</td>)}</tr>
          <tr><th scope="row">Índice Garimpo</th>{items.map((product) => <td key={product.id}><span className={styles.score}>{product.score}<small> / 100</small></span></td>)}</tr>
          <tr><th scope="row">Marca</th>{items.map((product) => <td key={product.id}>{product.brand}</td>)}</tr>
          <tr><th scope="row">Disponibilidade</th>{items.map((product, index) => <td key={product.id}>{offers[index]?.stock ?? 'Sem oferta'}</td>)}</tr>
          {specNames.map((spec) => <tr key={spec}><th scope="row">{spec}</th>{items.map((product) => <td key={product.id}>{product.specs[spec] ?? <span aria-label="Não informado">—</span>}</td>)}</tr>)}
          <tr><th scope="row">Saiba mais</th>{items.map((product, index) => { const offer = offers[index]; return <td key={product.id}><div className={styles.tableActions}>{offer && <a className={styles.primaryLink} href={offer.url} target="_blank" rel="sponsored noopener noreferrer" aria-label={`Ver oferta de ${product.name}`}>Ver oferta <ArrowUpRight aria-hidden="true"/></a>}<Link className={styles.textLink} href={`/produto/${product.slug}`}>Ver detalhes <ArrowRight aria-hidden="true"/></Link></div></td> })}</tr>
        </tbody></table>
      </div>
    </> : <><EmptyCollection mode="compare"/><SuggestedProducts mode="compare"/></>}
    <p className={styles.localNote}><LockKeyhole aria-hidden="true"/>Sua comparação fica salva neste navegador. Preços e avaliações vêm da Shopee e podem mudar lá.</p>
  </div></StorefrontShell>
}
