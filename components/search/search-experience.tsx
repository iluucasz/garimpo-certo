'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, History, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMock } from '@/components/mock-provider'
import { ProductGrid } from '@/components/product/product-card'
import { useStoreData } from '@/components/store-data-provider'
import { rankProducts, searchProducts } from '@/lib/mock-services'
import { platformServices } from '@/lib/platform'

const PAGE_SIZE = 8
const signalLabels = ['Escolha do editor', 'Em alta', 'Bom custo-benefício', 'Entrega grátis']

export function SearchExperience({ initialCategory }: { initialCategory?: string }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { savedSearches, saveSearch, removeSavedSearch } = useMock()
  const { products, categories, offers } = useStoreData()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState(initialCategory ?? params.get('categoria') ?? 'todos')
  const [sort, setSort] = useState(params.get('ordem') ?? 'relevancia')
  const [max, setMax] = useState(Number(params.get('precoMax') ?? 4000))
  const [signals, setSignals] = useState<string[]>(params.get('sinais')?.split(',').filter(Boolean) ?? [])
  const [page, setPage] = useState(Number(params.get('pagina') ?? 1))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const activeCategory = categories.find((item) => item.slug === category)

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1)
    return counts
  }, [products])

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    if (term.length < 2) return []
    return products.filter((product) => `${product.name} ${product.brand}`.toLocaleLowerCase('pt-BR').includes(term)).slice(0, 5)
  }, [query, products])

  const results = useMemo(() => rankProducts(searchProducts(products, query, category).filter((product) => {
    const price = product.priceHistory.length ? Math.min(...product.priceHistory.map((point) => point.price)) : 0
    const matchesSignals = signals.every((signal) => {
      if (signal === 'Escolha do editor') return product.score >= 90
      if (signal === 'Em alta') return product.growth >= 15
      if (signal === 'Bom custo-benefício') return product.score >= 85 && price <= 1500
      if (signal === 'Entrega grátis') return true
      return true
    })
    return price <= max && matchesSignals
  }), sort, offers), [products, offers, query, category, max, signals, sort])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeFilterCount = (category !== 'todos' ? 1 : 0) + (max !== 4000 ? 1 : 0) + signals.length

  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (category !== 'todos') next.set('categoria', category)
    if (sort !== 'relevancia') next.set('ordem', sort)
    if (max !== 4000) next.set('precoMax', String(max))
    if (signals.length) next.set('sinais', signals.join(','))
    if (page > 1) next.set('pagina', String(page))
    const url = `${pathname}${next.size ? `?${next.toString()}` : ''}`
    window.history.replaceState(null, '', url)
  }, [query, category, sort, max, signals, page, pathname])

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  useEffect(() => {
    if (!searchOpen) return
    function onPointerDown(event: MouseEvent) { if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false) }
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setSearchOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [searchOpen])

  function toggleSignal(signal: string) {
    setSignals((current) => current.includes(signal) ? current.filter((item) => item !== signal) : [...current, signal])
    setPage(1)
  }

  function clearFilters() {
    setQuery('')
    setCategory(initialCategory ?? 'todos')
    setSort('relevancia')
    setMax(4000)
    setSignals([])
    setPage(1)
  }

  function runSuggestion(slug: string, name: string) {
    setQuery(name)
    setPage(1)
    setSearchOpen(false)
    saveSearch(name)
    platformServices.tracker.track({ name: 'search_suggestion_selected', resource: 'search', resourceId: slug, actor: 'visitor' })
    router.push(`/produto/${slug}`)
  }

  function runRecentSearch(term: string) {
    setQuery(term)
    setPage(1)
    setSearchOpen(false)
  }

  function submitSearch() {
    if (query.trim()) saveSearch(query)
    setSearchOpen(false)
  }

  const heading = query ? `Resultados para “${query}”` : activeCategory ? activeCategory.name : 'Descubra sem se perder'
  const subheading = query
    ? 'Filtros úteis, ordenação clara e URLs compartilháveis. Preços e resultados são demonstrativos.'
    : activeCategory
      ? `${categoryCounts.get(activeCategory.slug) ?? 0} produtos selecionados em ${activeCategory.name.toLocaleLowerCase('pt-BR')}, prontos para comparar.`
      : `${products.length} produtos em ${categories.length} categorias, com filtros úteis, ordenação clara e URLs compartilháveis.`
  const showQuickCategories = !query && category === 'todos' && categories.length > 0

  return <>
    <section className="page-hero page-hero-compact container">
      <nav className="breadcrumbs" aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span>/</span>
        {activeCategory ? <><Link href="/buscar">Categorias</Link><span>/</span><span aria-current="page">{activeCategory.name}</span></> : <span aria-current="page">Descobrir</span>}
      </nav>
      <div className="kicker">CATÁLOGO CURADO</div>
      <h1>{heading}</h1>
      <p>{subheading}</p>
      <div className="search-combobox" ref={searchRef}>
        <div className="header-search">
          <Search/>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => { if (event.key === 'Enter') { submitSearch(); event.currentTarget.blur() } }}
            placeholder="Nome, marca ou benefício"
            aria-label="Buscar no catálogo"
          />
        </div>
        {searchOpen && suggestions.length > 0 && <div className="suggestions" role="listbox" aria-label="Sugestões de busca">
          {suggestions.map((product) => <button key={product.id} onClick={() => runSuggestion(product.slug, product.name)}><span>{product.name}</span><small>{product.brand}</small></button>)}
        </div>}
        {searchOpen && suggestions.length === 0 && query.trim().length < 2 && savedSearches.length > 0 && <div className="suggestions" role="listbox" aria-label="Buscas recentes">
          <div className="suggestions-label">Buscas recentes</div>
          {savedSearches.map((saved) => <div key={saved} className="suggestion-recent">
            <button onClick={() => runRecentSearch(saved)}><History/><span>{saved}</span></button>
            <button aria-label={`Remover busca ${saved}`} onClick={() => removeSavedSearch(saved)}><X/></button>
          </div>)}
        </div>}
      </div>

      {showQuickCategories && <div className="quick-categories">
        <span>Comece por uma categoria</span>
        <div className="quick-category-list">
          {categories.map((item) => <button type="button" key={item.id} className="quick-category-chip" onClick={() => { setCategory(item.slug); setPage(1) }}>{item.name}<small>{categoryCounts.get(item.slug) ?? 0}</small></button>)}
        </div>
      </div>}
    </section>

    <div className="container mobile-filter-trigger"><button className="btn secondary" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal/> {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}{activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}</button></div>
    <div className="container filters-layout">
      <aside className={`filter-panel ${filtersOpen ? 'open' : ''}`} aria-label="Filtros de busca">
        <div className="filter-panel-head"><h2>Filtros</h2>{activeFilterCount > 0 && <button className="text-link" onClick={clearFilters}>Limpar tudo</button>}</div>

        <fieldset>
          <legend>Categorias</legend>
          <div className="filter-options">
            <label className={`filter-option ${category === 'todos' ? 'active' : ''}`}><span><input type="radio" checked={category === 'todos'} onChange={() => { setCategory('todos'); setPage(1) }}/> Todas</span><small>{products.length}</small></label>
            {categories.map((item) => <label key={item.id} className={`filter-option ${category === item.slug ? 'active' : ''}`}><span><input type="radio" checked={category === item.slug} onChange={() => { setCategory(item.slug); setPage(1) }}/> {item.name}</span><small>{categoryCounts.get(item.slug) ?? 0}</small></label>)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Preço máximo</legend>
          <div className="price-filter">
            <input type="range" min="150" max="4000" step="50" value={max} onChange={(event) => { setMax(Number(event.target.value)); setPage(1) }} aria-label="Preço máximo"/>
            <strong>Até R$ {max.toLocaleString('pt-BR')}</strong>
          </div>
        </fieldset>

        <fieldset>
          <legend>Sinais</legend>
          <div className="signal-chips">
            {signalLabels.map((signal) => { const active = signals.includes(signal); return <button type="button" key={signal} className={`signal-chip ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => toggleSignal(signal)}>{active && <Check/>}{signal}</button> })}
          </div>
        </fieldset>
      </aside>

      <section aria-live="polite">
        <div className="results-bar"><div><strong>{results.length} produtos</strong>{signals.length > 0 && <small> · {signals.length} sinais ativos</small>}</div><label className="select-wrap"><span className="sr-only">Ordenar resultados</span><select className="select" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} style={{ width: 'auto' }}><option value="relevancia">Mais relevantes</option><option value="menor-preco">Menor preço</option><option value="avaliacao">Melhor avaliação</option><option value="crescimento">Em crescimento</option></select></label></div>
        {visible.length ? <ProductGrid items={visible}/> : <div className="empty-state"><SearchX/><h2>Nenhuma descoberta por aqui</h2><p>Tente remover um filtro ou buscar por um termo mais amplo.</p><button className="btn secondary" onClick={clearFilters}>Limpar filtros</button></div>}
        {totalPages > 1 && <nav className="pagination" aria-label="Paginação"><button className="btn secondary" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft/> Anterior</button><span>Página {page} de {totalPages}</span><button className="btn secondary" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Próxima <ChevronRight/></button></nav>}
      </section>
    </div>
  </>
}
