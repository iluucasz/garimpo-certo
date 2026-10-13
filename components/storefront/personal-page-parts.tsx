'use client'

import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ChevronRight, Clock3, GitCompareArrows, Heart, UserRound } from 'lucide-react'
import { useVisitorState } from '@/components/visitor-state-provider'
import { useStoreData } from '@/components/store-data-provider'
import { ProductGrid } from '@/components/product/product-card'
import styles from './personal-pages.module.css'

export type PersonalMode = 'favorites' | 'compare' | 'history'

export function PersonalHeading({ mode }: { mode: PersonalMode }) {
  const { favorites, compare, recent } = useVisitorState()
  const isFavorites = mode === 'favorites'
  const isHistory = mode === 'history'
  const title = isFavorites ? <>Seus <em>favoritos.</em></> : isHistory ? <>Vistos <em>recentemente.</em></> : <>Compare seus <em>achados.</em></>
  const lead = isFavorites ? 'Guarde o que chamou sua atenção. Volte quando quiser.' : isHistory ? 'Os produtos que você abriu neste navegador, do mais recente para o mais antigo.' : 'Preços e detalhes lado a lado, para você decidir com calma.'
  return <>
    <nav className={styles.breadcrumbs} aria-label="Caminho da página"><Link href="/">Início</Link><ChevronRight aria-hidden="true"/><span aria-current="page">{isFavorites ? 'Favoritos' : isHistory ? 'Histórico' : 'Comparador'}</span></nav>
    <div className={styles.heading}><div><span className={styles.eyebrow}>Seu Garimpo</span><h1>{title}</h1><p>{lead}</p></div><Link className={styles.textLink} href="/buscar">Continuar explorando <ArrowUpRight aria-hidden="true"/></Link></div>
    <nav className={styles.tabs} aria-label="Suas listas"><Link href="/favoritos" aria-current={isFavorites ? 'page' : undefined}><Heart aria-hidden="true"/>Favoritos<span>{favorites.length}</span></Link><Link href="/comparar" aria-current={mode === 'compare' ? 'page' : undefined}><GitCompareArrows aria-hidden="true"/>Comparador<span>{compare.length}</span></Link><Link href="/historico" aria-current={isHistory ? 'page' : undefined}><Clock3 aria-hidden="true"/>Histórico<span>{recent.length}</span></Link><Link href="/conta"><UserRound aria-hidden="true"/>Minha conta</Link></nav>
  </>
}

export function EmptyCollection({ mode }: { mode: PersonalMode }) {
  const favorites = mode === 'favorites'
  if (mode === 'history') return <div className={styles.empty}>
    <div className={styles.emptyIntro}><Clock3 aria-hidden="true"/><h2>Nada visto por enquanto.</h2><p>Os produtos que você abrir aparecem aqui, para retomar de onde parou.</p><Link className={styles.primaryLink} href="/buscar">Explorar o catálogo <ArrowRight aria-hidden="true"/></Link></div>
  </div>
  const Icon = favorites ? Heart : GitCompareArrows
  return <div className={styles.empty}>
    <div className={styles.emptyIntro}><Icon aria-hidden="true"/><h2>{favorites ? 'Sua seleção começa aqui.' : 'O que você quer comparar?'}</h2><p>{favorites ? 'Ainda não tem favoritos. Toque no coração de um produto para guardá-lo na sua seleção.' : 'Adicione até quatro produtos e confira as diferenças de preço, avaliação e características.'}</p><Link className={styles.primaryLink} href="/buscar">Explorar o catálogo <ArrowRight aria-hidden="true"/></Link></div>
    <ol className={styles.steps}><li><span>01</span><div><strong>{favorites ? 'Encontrou algo interessante?' : 'Escolha os produtos'}</strong><p>{favorites ? 'Salve pelo coração, sem interromper sua busca.' : 'Use o botão Comparar nos produtos ou adicione pela lista acima.'}</p></div></li><li><span>02</span><div><strong>{favorites ? 'Retome no seu tempo' : 'Veja o que muda'}</strong><p>{favorites ? 'Seus produtos ficam reunidos aqui para rever e comparar.' : 'Compare as informações e abra a oferta na loja que preferir.'}</p></div></li></ol>
  </div>
}

export function SuggestedProducts({ mode }: { mode: PersonalMode }) {
  const { products } = useStoreData()
  const suggestions = [...products].sort((a, b) => b.score - a.score).slice(0, 4)
  if (!suggestions.length) return null
  return <section className={styles.suggestions} aria-labelledby="suggested-title"><div className={styles.sectionHeading}><div><h2 id="suggested-title">Um começo para sua seleção.</h2><p>{mode === 'compare' ? 'Use o botão Comparar para colocar estes produtos lado a lado.' : 'Alguns produtos do catálogo para você conhecer.'}</p></div><Link className={styles.textLink} href="/buscar">Ver todo o catálogo <ArrowUpRight aria-hidden="true"/></Link></div><ProductGrid items={suggestions}/></section>
}
