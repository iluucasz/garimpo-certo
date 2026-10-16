'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, History, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useVisitorState } from '@/components/visitor-state-provider'
import { ProductGrid } from '@/components/product/product-card'
import { useStoreData } from '@/components/store-data-provider'
import { rankProducts, searchProducts } from '@/lib/catalog/search'
import { catalogSignals, currentPrice, matchesSignal } from '@/lib/catalog/signals'
import { platformServices } from '@/lib/platform'
import styles from './search-experience.module.css'

const PAGE_SIZE = 12
const sortOptions = [
  { value: 'relevancia', label: 'Mais relevantes' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'avaliacao', label: 'Melhor avaliação' },
  { value: 'mais-vendidos', label: 'Mais vendidos' },
]

export type SearchParams = Partial<Record<'q' | 'categoria' | 'ordem' | 'precoMax' | 'sinais' | 'pagina', string>>

/**
 * `initialParams` vem do servidor (`/buscar` lê os searchParams), então a grade já sai no HTML e as primeiras
 * imagens começam a baixar antes da hidratação. Em páginas estáticas (categorias) não há parâmetros no servidor;
 * eles são aplicados uma vez depois da montagem.
 */
export function SearchExperience({ initialCategory, initialParams }: { initialCategory?: string; initialParams?: SearchParams }) {
  const params = { get: (name: keyof SearchParams) => initialParams?.[name] ?? null }
  const pathname = usePathname()
  const router = useRouter()
  const { savedSearches, saveSearch, removeSavedSearch } = useVisitorState()
  const { products, categories, offers, rules } = useStoreData()
  const urlQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [category, setCategory] = useState(initialCategory ?? params.get('categoria') ?? 'todos')
  const [sort, setSort] = useState(sortOptions.some((option) => option.value === params.get('ordem')) ? params.get('ordem')! : 'relevancia')
  const priceCeiling = useMemo(() => Math.max(50, Math.ceil(Math.max(0, ...products.map((product) => currentPrice(product, offers))) / 10) * 10), [products, offers])
  const [maxParam, setMax] = useState<number | null>(params.get('precoMax') ? Number(params.get('precoMax')) : null)
  const max = Math.min(maxParam ?? priceCeiling, priceCeiling)
  const [signals, setSignals] = useState<string[]>(params.get('sinais')?.split(',').filter(Boolean) ?? [])
  const [page, setPage] = useState(Number(params.get('pagina') ?? 1))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const lastUrlQuery = useRef(urlQuery)

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

  const results = useMemo(() => {
    const filtered = searchProducts(products, query, category).filter((product) => currentPrice(product, offers) <= max && signals.every((signal) => matchesSignal(signal, product, offers, rules)))
    if (sort === 'mais-vendidos') {
      const sold = (id: string) => Math.max(0, ...offers.filter((offer) => offer.productId === id).map((offer) => offer.soldCount ?? 0))
      return [...filtered].sort((a, b) => sold(b.id) - sold(a.id))
    }
    return rankProducts(filtered, sort, offers)
  }, [products, offers, query, category, max, signals, sort, rules])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const priceActive = max < priceCeiling
  const activeFilterCount = (category !== (initialCategory ?? 'todos') ? 1 : 0) + (priceActive ? 1 : 0) + signals.length

  // Páginas estáticas (ex.: /categorias/cozinha?ordem=menor-preco) só conhecem os parâmetros no navegador.
  useEffect(() => {
    if (initialParams) return
    const search = new URLSearchParams(window.location.search)
    if (![...search.keys()].length) return
    const q = search.get('q'); if (q) setQuery(q)
    const ordem = search.get('ordem'); if (ordem && sortOptions.some((option) => option.value === ordem)) setSort(ordem)
    const precoMax = search.get('precoMax'); if (precoMax && Number.isFinite(Number(precoMax))) setMax(Number(precoMax))
    const sinais = search.get('sinais'); if (sinais) setSignals(sinais.split(',').filter(Boolean))
    const pagina = Number(search.get('pagina') ?? 1); if (pagina > 1) setPage(pagina)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mantém o campo em sincronia quando a busca do cabeçalho muda a URL com esta página já aberta.
  useEffect(() => {
    if (lastUrlQuery.current === urlQuery) return
    lastUrlQuery.current = urlQuery
    setQuery((current) => (current === urlQuery ? current : urlQuery))
    setPage(1)
  }, [urlQuery])

  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (category !== 'todos' && category !== initialCategory) next.set('categoria', category)
    if (sort !== 'relevancia') next.set('ordem', sort)
    if (priceActive) next.set('precoMax', String(max))
    if (signals.length) next.set('sinais', signals.join(','))
    if (page > 1) next.set('pagina', String(page))
    const url = `${pathname}${next.size ? `?${next.toString()}` : ''}`
    window.history.replaceState(null, '', url)
  }, [query, category, initialCategory, sort, max, priceActive, signals, page, pathname])

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
    setMax(null)
    setSignals([])
    setPage(1)
  }

  function goToPage(next: number) {
    setPage(next)
    resultsRef.current?.scrollIntoView({ block: 'start' })
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

  const heading = query ? `Resultados para “${query}”` : activeCategory ? activeCategory.name : 'Todos os achados'
  const showQuickCategories = !query && category === 'todos' && categories.length > 0
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(category !== (initialCategory ?? 'todos') && activeCategory ? [{ key: 'categoria', label: activeCategory.name, remove: () => { setCategory(initialCategory ?? 'todos'); setPage(1) } }] : []),
    ...(priceActive ? [{ key: 'preco', label: `Até R$ ${max.toLocaleString('pt-BR')}`, remove: () => { setMax(null); setPage(1) } }] : []),
    ...signals.map((signal) => ({ key: signal, label: signal, remove: () => toggleSignal(signal) })),
  ]
  const statusText = results.length ? `${results.length} ${results.length === 1 ? 'produto encontrado' : 'produtos encontrados'}.` : 'Nenhum produto encontrado.'

  return <>
    <section className={`${styles.hero} container`}>
      <nav className={styles.breadcrumbs} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        {activeCategory ? <><Link href="/buscar">Descobrir</Link><span aria-hidden="true">/</span><span aria-current="page">{activeCategory.name}</span></> : <span aria-current="page">Descobrir</span>}
      </nav>
      <h1>{heading}</h1>
      <div className={styles.searchWrap} ref={searchRef}>
        <div className={styles.searchField}>
          <Search aria-hidden="true"/>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => { if (event.key === 'Enter') { submitSearch(); event.currentTarget.blur() } }}
            placeholder="Nome, marca ou benefício"
            aria-label="Buscar no catálogo"
          />
          {query && <button type="button" className={styles.clearQuery} aria-label="Limpar busca" onClick={() => { setQuery(''); setPage(1) }}><X aria-hidden="true"/></button>}
        </div>
        {searchOpen && suggestions.length > 0 && <div className={styles.suggestions} role="listbox" aria-label="Sugestões de busca">
          {suggestions.map((product) => <button type="button" key={product.id} onClick={() => runSuggestion(product.slug, product.name)}><span>{product.name}</span><small>{product.brand}</small></button>)}
        </div>}
        {searchOpen && suggestions.length === 0 && query.trim().length < 2 && savedSearches.length > 0 && <div className={styles.suggestions} role="listbox" aria-label="Buscas recentes">
          <div className={styles.suggestionsLabel}>Buscas recentes</div>
          {savedSearches.map((saved) => <div key={saved} className={styles.recent}>
            <button type="button" onClick={() => runRecentSearch(saved)}><History aria-hidden="true"/><span>{saved}</span></button>
            <button type="button" aria-label={`Remover busca ${saved}`} onClick={() => removeSavedSearch(saved)}><X aria-hidden="true"/></button>
          </div>)}
        </div>}
      </div>

      {showQuickCategories && <div className={styles.quick} role="group" aria-label="Comece por uma categoria">
        {categories.map((item) => <button type="button" key={item.id} onClick={() => { setCategory(item.slug); setPage(1) }}>{item.name}<small>{categoryCounts.get(item.slug) ?? 0}</small></button>)}
      </div>}
    </section>

    <div className={`container ${styles.layout}`}>
      <div className={styles.toolbar} ref={resultsRef}>
        <button type="button" className={styles.filterToggle} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="filtros-busca"><SlidersHorizontal aria-hidden="true"/>Filtros{activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}</button>
        <p className={styles.count}><strong>{results.length}</strong> {results.length === 1 ? 'produto' : 'produtos'}</p>
        <label className={styles.sort}><span>Ordenar por</span><select aria-label="Ordenar por" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>

      <aside id="filtros-busca" className={`${styles.panel} ${filtersOpen ? styles.panelOpen : ''}`} aria-label="Filtros de busca">
        <div className={styles.panelHead}><h2>Filtros</h2>{(activeFilterCount > 0 || query) && <button type="button" onClick={clearFilters}>Limpar tudo</button>}</div>

        <fieldset>
          <legend>Categoria</legend>
          <div className={styles.options}>
            <label className={category === 'todos' ? styles.optionActive : ''}><span><input type="radio" name="categoria" checked={category === 'todos'} onChange={() => { setCategory('todos'); setPage(1) }}/>Todas</span><small>{products.length}</small></label>
            {categories.map((item) => <label key={item.id} className={category === item.slug ? styles.optionActive : ''}><span><input type="radio" name="categoria" checked={category === item.slug} onChange={() => { setCategory(item.slug); setPage(1) }}/>{item.name}</span><small>{categoryCounts.get(item.slug) ?? 0}</small></label>)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Preço máximo</legend>
          <div className={styles.price}>
            <input type="range" min="10" max={priceCeiling} step="10" value={Math.max(10, max)} onChange={(event) => { setMax(Number(event.target.value)); setPage(1) }} aria-label="Preço máximo"/>
            <div><span>R$ 10</span><strong>Até R$ {max.toLocaleString('pt-BR')}</strong></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Destaques</legend>
          <div className={styles.signals}>
            {catalogSignals.map((signal) => { const active = signals.includes(signal); return <button type="button" key={signal} className={active ? styles.signalActive : ''} aria-pressed={active} onClick={() => toggleSignal(signal)}>{active && <Check aria-hidden="true"/>}{signal}</button> })}
          </div>
        </fieldset>
      </aside>

      <section className={styles.results} aria-labelledby="resultados-titulo">
        <h2 id="resultados-titulo" className="sr-only">Resultados</h2>
        <p className="sr-only" role="status">{statusText}</p>
        {chips.length > 0 && <ul className={styles.chips} aria-label="Filtros ativos">{chips.map((chip) => <li key={chip.key}><button type="button" onClick={chip.remove} aria-label={`Remover filtro ${chip.label}`}>{chip.label}<X aria-hidden="true"/></button></li>)}</ul>}
        {visible.length
          ? <ProductGrid items={visible} eagerCount={4}/>
          : <div className={styles.empty}>
            <SearchX aria-hidden="true"/>
            <h2>Nenhum produto encontrado</h2>
            <button type="button" onClick={clearFilters}>Limpar filtros</button>
          </div>}
        {totalPages > 1 && <nav className={styles.pagination} aria-label="Paginação">
          <button type="button" disabled={page === 1} onClick={() => goToPage(page - 1)}><ChevronLeft aria-hidden="true"/>Anterior</button>
          <span aria-current="page">Página {page} de {totalPages}</span>
          <button type="button" disabled={page === totalPages} onClick={() => goToPage(page + 1)}>Próxima<ChevronRight aria-hidden="true"/></button>
        </nav>}
      </section>
    </div>
  </>
}
