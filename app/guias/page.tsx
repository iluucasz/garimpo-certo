import Image from 'next/image'
import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/storefront-shell'
import { articles } from '@/lib/mock-data'
export const metadata={title:'Guias de compra'}
export default function GuidesPage(){return <StorefrontShell><section className="page-hero container"><div className="kicker">CONTEÚDO EDITORIAL</div><h1>Comprar melhor também se aprende.</h1><p>Guias diretos, comparações honestas e seleções para ajudar você a decidir sem pressa.</p></section><section className="container section" style={{paddingTop:20}}><div className="article-grid">{articles.map(a=><Link href={`/guias/${a.slug}`} className="article-card" key={a.id}><div className="article-image"><Image src={a.image} alt="" fill/></div><span>{a.category} · {a.readTime}</span><h2>{a.title}</h2><p>{a.excerpt}</p></Link>)}</div></section></StorefrontShell>}
