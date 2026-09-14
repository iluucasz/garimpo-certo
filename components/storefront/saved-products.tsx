'use client'
import Link from 'next/link'
import { Clock3, Heart } from 'lucide-react'
import { useMock } from '@/components/mock-provider'
import { ProductGrid } from '@/components/product/product-card'
import { useStoreData } from '@/components/store-data-provider'
export function SavedProducts({mode}:{mode:'favorites'|'recent'}){const state=useMock();const{products}=useStoreData();const ids=mode==='favorites'?state.favorites:state.recent;const items=ids.map(id=>products.find(p=>p.id===id)).filter(Boolean) as typeof products;return <section className="container section" style={{paddingTop:20}}>{items.length?<><div className="results-bar"><strong>{items.length} {mode==='favorites'?'favoritos':'itens vistos'}</strong>{mode==='recent'&&<button className="btn secondary" onClick={state.clearHistory}>Limpar histórico</button>}</div><ProductGrid items={items}/></>:<div className="empty-state">{mode==='favorites'?<Heart/>:<Clock3/>}<h2>{mode==='favorites'?'Nenhum favorito ainda':'Seu histórico está vazio'}</h2><p>Explore o catálogo e suas escolhas aparecerão aqui.</p><Link href="/buscar" className="btn primary">Descobrir produtos</Link></div>}</section>}
