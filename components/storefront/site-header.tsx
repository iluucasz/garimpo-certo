'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { GitCompareArrows, Heart, Menu, Search, X } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { AccountMenu } from './account-menu'

export function SiteHeader(){
 const router=useRouter(),{favorites,compare}=useMock();const [query,setQuery]=useState(''),[open,setOpen]=useState(false)
 const submit=(e:FormEvent)=>{e.preventDefault();if(query.trim())router.push(`/buscar?q=${encodeURIComponent(query)}`)}
 return <>
  <div className="mock-ribbon">AMBIENTE DEMONSTRATIVO · preços, avaliações e disponibilidade são simulados</div>
  <header className="site-header"><div className="site-header-inner">
   <Link href="/" className="brand" aria-label="Garimpo certo, página inicial"><span>G</span><span className="brand-word"><span className="brand-stem">arim<small><span>c</span><span>e</span><span>r</span><span>t</span><span>o</span></small></span>po</span></Link>
   <nav className="desktop-nav" aria-label="Navegação principal"><Link href="/buscar">Descobrir</Link><Link href="/categorias/tecnologia">Categorias</Link><Link href="/colecoes/mesa-bem-resolvida">Coleções</Link><Link href="/guias">Guias</Link></nav>
   <form onSubmit={submit} className="header-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produtos e marcas" aria-label="Buscar produtos"/></form>
   <div className="header-actions"><Link href="/comparar" aria-label={`${compare.length} produtos no comparador`}><GitCompareArrows/><span>{compare.length||''}</span></Link><Link href="/favoritos" aria-label={`${favorites.length} favoritos`}><Heart/><span>{favorites.length||''}</span></Link><AccountMenu/><button onClick={()=>setOpen(!open)} className="mobile-menu" aria-label="Abrir menu">{open?<X/>:<Menu/>}</button></div>
  </div>{open&&<nav className="mobile-nav"><Link href="/buscar">Descobrir</Link><Link href="/categorias/tecnologia">Categorias</Link><Link href="/colecoes/mesa-bem-resolvida">Coleções</Link><Link href="/guias">Guias</Link><Link href="/admin">Painel admin</Link></nav>}</header>
 </>
}
