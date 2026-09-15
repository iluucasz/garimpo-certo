'use client'

import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ChevronRight, GitCompareArrows, Heart, UserRound } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { useStoreData } from '@/components/store-data-provider'
import { ProductGrid } from '@/components/product/product-card'
import styles from './personal-pages.module.css'

export function PersonalHeading({ mode }: { mode: 'favorites' | 'compare' }) {
  const { favorites, compare } = useMock()
  const isFavorites = mode === 'favorites'
  return <>
    <nav className={styles.breadcrumbs} aria-label="Caminho da página"><Link href="/">Início</Link><ChevronRight aria-hidden="true"/><span aria-current="page">{isFavorites ? 'Favoritos' : 'Comparador'}</span></nav>
    <div className={styles.heading}><div><span className={styles.eyebrow}>SEU GARIMPO</span><h1>{isFavorites ? <>Seus <em>favoritos.</em></> : <>Compare seus <em>achados.</em></>}</h1><p>{isFavorites ? 'Guarde o que chamou sua atenção. Volte quando quiser.' : 'Preços e detalhes lado a lado, para você decidir com calma.'}</p></div><Link className={styles.textLink} href="/buscar">Continuar explorando <ArrowUpRight aria-hidden="true"/></Link></div>
    <nav className={styles.tabs} aria-label="Suas listas"><Link href="/favoritos" aria-current={isFavorites ? 'page' : undefined}><Heart aria-hidden="true"/>Favoritos<span>{favorites.length}</span></Link><Link href="/comparar" aria-current={!isFavorites ? 'page' : undefined}><GitCompareArrows aria-hidden="true"/>Comparador<span>{compare.length}</span></Link><Link href="/conta"><UserRound aria-hidden="true"/>Minha conta</Link></nav>
  </>
}

export function EmptyCollection({ mode }: { mode: 'favorites' | 'compare' }) {
  const favorites = mode === 'favorites'
  const Icon = favorites ? Heart : GitCompareArrows
  return <div className={styles.empty}>
    <div className={styles.emptyIntro}><Icon aria-hidden="true"/><h2>{favorites ? 'Sua seleção começa aqui.' : 'O que você quer comparar?'}</h2><p>{favorites ? 'Ainda não tem favoritos. Toque no coração de um produto para guardá-lo na sua seleção.' : 'Adicione até quatro produtos e confira as diferenças de preço, avaliação e características.'}</p><Link className={styles.primaryLink} href="/buscar">Explorar o catálogo <ArrowRight aria-hidden="true"/></Link></div>
    <ol className={styles.steps}><li><span>01</span><div><strong>{favorites ? 'Encontrou algo interessante?' : 'Escolha os produtos'}</strong><p>{favorites ? 'Salve pelo coração, sem interromper sua busca.' : 'Use o botão Comparar nos produtos ou adicione pela lista acima.'}</p></div></li><li><span>02</span><div><strong>{favorites ? 'Retome no seu tempo' : 'Veja o que muda'}</strong><p>{favorites ? 'Seus produtos ficam reunidos aqui para rever e comparar.' : 'Compare as informações e abra a oferta na loja que preferir.'}</p></div></li></ol>
  </div>
}

export function SuggestedProducts({ mode }: { mode: 'favorites' | 'compare' }) {
  const { products } = useStoreData()
  const suggestions = [...products].sort((a, b) => b.score - a.score).slice(0, 4)
  if (!suggestions.length) return null
  return <section className={styles.suggestions} aria-labelledby="suggested-title"><div className={styles.sectionHeading}><div><h2 id="suggested-title">Um começo para sua seleção.</h2><p>{mode === 'favorites' ? 'Alguns produtos do catálogo para você conhecer e salvar.' : 'Use o botão Comparar para colocar estes produtos lado a lado.'}</p></div><Link className={styles.textLink} href="/buscar">Ver todo o catálogo <ArrowUpRight aria-hidden="true"/></Link></div><ProductGrid items={suggestions}/></section>
}
