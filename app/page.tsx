import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, BookOpen, RefreshCw, Search, ShieldCheck, Store } from 'lucide-react'
import { HomeCatalog } from '@/components/home/home-catalog'
import { HeroDealCarousel } from '@/components/home/hero-deal-carousel'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { articles, collections, formatPrice } from '@/lib/mock-data'
import { getStoreCatalog } from '@/lib/db/repositories/store-catalog'

const validFilters=['trending','discount','rating','budget'] as const
type HomeFilter=(typeof validFilters)[number]

export default async function Home({searchParams}:{searchParams:Promise<{filtro?:string}>}){
 const params=await searchParams
 const activeFilter=validFilters.includes(params.filtro as HomeFilter)?params.filtro as HomeFilter:'trending'
 const { products, offers, providers } = await getStoreCatalog()
 const heroSlides=[...products].sort((a,b)=>b.growth-a.growth).slice(0,4).map(product=>{
  const offer=offers.filter(item=>item.productId===product.id).sort((a,b)=>a.price-b.price)[0]
  const provider=providers.find(item=>item.id===offer?.providerId)
  return {id:product.id,name:product.name,slug:product.slug,description:product.description,image:product.image,provider:provider?.name??'',price:formatPrice(offer?.price??0),previousPrice:formatPrice(offer?.previousPrice??offer?.price??0),discount:offer?Math.round((1-offer.price/(offer.previousPrice??offer.price))*100):0}
 })
 return <StorefrontShell>
  <main>
   <section className="commerce-hero"><div className="container commerce-hero-grid">
    <div className="commerce-hero-copy"><div className="kicker">SEU ATALHO PARA COMPRAR MELHOR</div><h1>Boas escolhas, preços comparados.</h1><p>Descubra produtos úteis, compare ofertas de diferentes lojas e encontre o melhor custo-benefício sem abrir dezenas de abas.</p>
     <form action="/buscar" className="hero-search"><Search/><input name="q" aria-label="Buscar na página inicial" placeholder="O que você está procurando?"/><button type="submit">Buscar</button></form>
     <div className="popular-searches"><span>Buscas populares:</span><Link href="/buscar?q=fone">Fones</Link><Link href="/buscar?q=air+fryer">Air fryer</Link><Link href="/buscar?q=home+office">Home office</Link></div>
    </div>
    <HeroDealCarousel slides={heroSlides} />
   </div></section>

   <section className="commerce-benefits" aria-label="Benefícios do Garimpo"><div className="container"><div><BadgeCheck/><span><strong>Curadoria criteriosa</strong><small>Qualidade antes do desconto</small></span></div><div><Store/><span><strong>Ofertas comparadas</strong><small>Até 4 lojas por produto</small></span></div><div><RefreshCw/><span><strong>Preços monitorados</strong><small>Histórico demonstrativo</small></span></div><div><ShieldCheck/><span><strong>Compra transparente</strong><small>Você escolhe onde comprar</small></span></div></div></section>

   <HomeCatalog activeFilter={activeFilter}/>

   <section className="container section home-collections"><div className="section-heading compact-heading"><div><div className="kicker">COLEÇÕES EDITORIAIS</div><h2>Atalhos para decisões melhores.</h2><p>Seleções prontas para momentos, necessidades e orçamentos diferentes.</p></div></div><div className="collection-grid">{collections.map((collection,index)=><Link href={`/colecoes/${collection.slug}`} className={`collection-card collection-${index+1}`} key={collection.id}><span>{collection.tone}</span><h3>{collection.title}</h3><p>{collection.description}</p><strong>Ver {collection.productIds.length} escolhas <ArrowRight/></strong></Link>)}</div></section>

   <section className="editorial-section home-guides"><div className="container"><div className="section-heading light compact-heading"><div><div className="kicker">GUIAS GARIMPO</div><h2>Informação para comprar sem arrependimento.</h2></div><Link href="/guias">Todos os guias <ArrowRight/></Link></div><div className="article-grid">{articles.map(article=><Link href={`/guias/${article.slug}`} className="article-card" key={article.id}><div className="article-image"><Image src={article.image} alt="" fill sizes="(max-width: 700px) 100vw, 33vw"/></div><span>{article.category} · {article.readTime}</span><h3>{article.title}</h3><p>{article.excerpt}</p><strong>Ler guia <BookOpen/></strong></Link>)}</div></div></section>

   <section className="container trust-panel" aria-labelledby="trust-title"><div><div className="kicker">TRANSPARÊNCIA EM PRIMEIRO LUGAR</div><h2 id="trust-title">Você decide. O Garimpo ajuda a comparar.</h2><p>Os preços, estoques, avaliações e métricas desta demonstração são fictícios. Em uma operação real, você sempre verá quando a oferta foi atualizada e será redirecionado para concluir a compra na loja parceira.</p></div><Link href="/como-funciona" className="btn secondary">Entenda como funciona <ArrowRight/></Link></section>
  </main>
 </StorefrontShell>
}
