'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Camera, Coffee, Cpu, Headphones, House, Sparkles, Tag, Star, TrendingUp, WalletCards } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { useStoreData } from '@/components/store-data-provider'
import { formatPrice } from '@/lib/mock-data'

const icons={Cpu,House,Headphones,Coffee,Sparkles,Camera} as const
const filters=[
  {id:'trending',label:'Em alta',icon:TrendingUp},
  {id:'discount',label:'Maior desconto',icon:Tag},
  {id:'rating',label:'Melhor avaliados',icon:Star},
  {id:'budget',label:'Até R$ 300',icon:WalletCards},
] as const
const categoryGroups=[
  {id:'tech',kicker:'TECNOLOGIA & FOTOGRAFIA',title:'Para trabalhar, criar e registrar',description:'Equipamentos bem avaliados para uma rotina mais produtiva e criativa.',slugs:['tecnologia','fotografia']},
  {id:'home',kicker:'CASA & COZINHA',title:'Para deixar a rotina mais simples',description:'Utilidades que resolvem tarefas e tornam os pequenos rituais melhores.',slugs:['casa','cozinha']},
  {id:'life',kicker:'ÁUDIO & BEM-ESTAR',title:'Para aproveitar e cuidar de você',description:'Som, movimento e pausas escolhidos pelo equilíbrio entre qualidade e preço.',slugs:['audio','bem-estar']},
]

type FilterId=(typeof filters)[number]['id']

export function HomeCatalog({activeFilter='trending'}:{activeFilter?:FilterId}){
 const { products, categories, getOffers } = useStoreData()
 const currentPrice=(id:string)=>getOffers(id)[0]?.price??0
 const discount=(id:string)=>{const offer=getOffers(id)[0];return offer?.previousPrice?Math.round((1-offer.price/offer.previousPrice)*100):0}
 const sorted={
  trending:[...products].sort((a,b)=>b.growth-a.growth),
  discount:[...products].sort((a,b)=>discount(b.id)-discount(a.id)),
  rating:[...products].sort((a,b)=>b.rating-a.rating||b.reviews-a.reviews),
  budget:products.filter(product=>currentPrice(product.id)<=300).sort((a,b)=>b.score-a.score),
 }[activeFilter]
 return <>
  <section className="container home-categories" aria-labelledby="home-categories-title">
   <div className="section-heading compact-heading"><div><div className="kicker">COMPRE POR CATEGORIA</div><h2 id="home-categories-title">Encontre o que você precisa.</h2></div><Link href="/buscar">Ver catálogo completo <ArrowRight/></Link></div>
   <div className="category-showcase">{categories.map(category=>{const Icon=icons[category.icon as keyof typeof icons]??Sparkles;const items=products.filter(product=>product.category===category.slug);const lowest=items.length?Math.min(...items.map(product=>currentPrice(product.id))):0;const image=items[0]?.image??'/placeholder.jpg';return <Link href={`/categorias/${category.slug}`} className="category-visual-card" key={category.id}>
    <div className="category-visual-image"><Image src={image} alt="" fill sizes="(max-width: 700px) 45vw, 190px"/></div>
    <div className="category-visual-copy"><span><Icon/>{items.length} produtos</span><strong>{category.name}</strong><small>A partir de {formatPrice(lowest)}</small></div><ArrowRight className="category-arrow"/>
   </Link>})}</div>
  </section>

  <section className="home-featured" aria-labelledby="featured-title"><div className="container">
   <div className="section-heading compact-heading"><div><div className="kicker">MELHORES OPORTUNIDADES</div><h2 id="featured-title">Ofertas que merecem atenção hoje.</h2><p>Preços e rankings atualizados para facilitar sua escolha.</p></div><Link href="/buscar">Explorar todas <ArrowRight/></Link></div>
   <nav className="product-filter-nav" aria-label="Filtrar vitrine principal">{filters.map(filter=>{const Icon=filter.icon;return <Link key={filter.id} href={`/?filtro=${filter.id}#ofertas`} className={activeFilter===filter.id?'active':''} aria-current={activeFilter===filter.id?'true':undefined}><Icon/>{filter.label}</Link>})}</nav>
   <div id="ofertas"><ProductGrid items={sorted.slice(0,8)}/></div>
  </div></section>

  {categoryGroups.map((group,index)=>{const groupProducts=products.filter(product=>group.slugs.includes(product.category));if(!groupProducts.length)return null;return <section className={index===1?'category-product-section soft':'category-product-section'} key={group.id} aria-labelledby={`${group.id}-title`}><div className="container">
   <div className="section-heading compact-heading"><div><div className="kicker">{group.kicker}</div><h2 id={`${group.id}-title`}>{group.title}</h2><p>{group.description}</p></div><div className="category-section-links">{group.slugs.map(slug=>categories.find(category=>category.slug===slug)?<Link key={slug} href={`/categorias/${slug}`}>Ver {categories.find(category=>category.slug===slug)?.name}<ArrowRight/></Link>:null)}</div></div>
   <ProductGrid items={groupProducts}/>
  </div></section>})}

  <section className="container recent-drops" aria-labelledby="drops-title"><div className="section-heading compact-heading"><div><div className="kicker">PREÇO EM MOVIMENTO</div><h2 id="drops-title">Baixaram de preço recentemente.</h2><p>Uma seleção ordenada pela queda registrada no histórico.</p></div><Link href="/buscar?ordem=preco">Ver mais quedas <ArrowRight/></Link></div><ProductGrid items={[...products].sort((a,b)=>discount(b.id)-discount(a.id)).slice(0,4)}/></section>
 </>
}
