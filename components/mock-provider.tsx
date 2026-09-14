'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { platformServices } from '@/lib/platform'
import { useSession } from '@/lib/auth/client'
import { useStoreData } from '@/components/store-data-provider'

export interface CookiePreferences {
  essential: true
  analytics: boolean
  personalization: boolean
  marketing: boolean
}

export interface UserPreferences {
  categories: string[]
  maxPrice: number
  notifications: boolean
  newsletter: boolean
}

interface MockState {
  hydrated: boolean
  favorites: string[]
  recent: string[]
  compare: string[]
  consent: boolean | null
  cookiePreferences: CookiePreferences
  preferences: UserPreferences
  savedSearches: string[]
  toggleFavorite: (id: string) => void
  toggleCompare: (id: string) => void
  addRecent: (id: string) => void
  clearRecent: () => void
  clearHistory: () => void
  setConsent: (value: boolean) => void
  saveCookiePreferences: (value: CookiePreferences) => void
  savePreferences: (value: UserPreferences) => void
  saveSearch: (query: string) => void
  removeSavedSearch: (query: string) => void
}

const defaultCookies: CookiePreferences = { essential: true, analytics: false, personalization: false, marketing: false }
const defaultPreferences: UserPreferences = { categories: ['Tecnologia', 'Casa'], maxPrice: 1500, notifications: true, newsletter: false }
const MockContext = createContext<MockState | null>(null)

function readArray(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[] } catch { return [] }
}
function readObject<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) as T } catch { return fallback }
}
function persist(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)) }

export function MockProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { products } = useStoreData()
  const syncedUserId = useRef<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [compare, setCompare] = useState<string[]>([])
  const [consent, setConsentState] = useState<boolean | null>(null)
  const [cookiePreferences, setCookiePreferences] = useState(defaultCookies)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [savedSearches, setSavedSearches] = useState<string[]>([])

  useEffect(() => {
    const validIds = new Set(products.map((product) => product.id))
    const pruneStale = (key: string) => {
      const stored = readArray(key)
      const pruned = stored.filter((id) => validIds.has(id))
      if (pruned.length !== stored.length) persist(key, pruned)
      return pruned
    }
    setFavorites(pruneStale('garimpo:favorites'))
    setRecent(pruneStale('garimpo:recent'))
    setCompare(pruneStale('garimpo:compare'))
    setSavedSearches(readArray('garimpo:saved-searches'))
    const storedConsent = localStorage.getItem('garimpo:consent')
    setConsentState(storedConsent === null ? null : storedConsent === 'true')
    setCookiePreferences(readObject('garimpo:cookie-preferences', defaultCookies))
    setPreferences(readObject('garimpo:user-preferences', defaultPreferences))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!session || syncedUserId.current === session.user.id) return
    syncedUserId.current = session.user.id
    const local = readArray('garimpo:favorites')
    fetch('/api/v1/wishlist').then((response) => response.ok ? response.json() : null).then(async (body) => {
      const remote = (body?.data as string[] | undefined) ?? []
      const toMerge = local.filter((id) => !remote.includes(id))
      if (!toMerge.length) { setFavorites(remote); return }
      const mergeResponse = await fetch('/api/v1/wishlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productIds: toMerge }) })
      const mergeBody = mergeResponse.ok ? await mergeResponse.json() : null
      setFavorites((mergeBody?.data as string[] | undefined) ?? remote)
    }).catch(() => {})
  }, [session])

  const toggleFavorite = useCallback((id: string) => {
    if (session) {
      setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [id, ...current])
      fetch('/api/v1/wishlist/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: id }) })
        .then((response) => response.ok ? response.json() : null)
        .then((body) => { if (body?.data.productIds) setFavorites(body.data.productIds) })
        .catch(() => {})
      platformServices.tracker.track({ name: 'favorite_toggled', resource: 'product', resourceId: id, actor: session.user.id })
      return
    }
    setFavorites((current) => {
      const removing = current.includes(id)
      const next = removing ? current.filter((item) => item !== id) : [id, ...current]
      persist('garimpo:favorites', next)
      platformServices.tracker.track({ name: removing ? 'favorite_removed' : 'favorite_added', resource: 'product', resourceId: id, actor: 'visitor' })
      return next
    })
  }, [session])

  const toggleCompare = useCallback((id: string) => {
    setCompare((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-4)
      persist('garimpo:compare', next)
      platformServices.tracker.track({ name: 'compare_updated', resource: 'product', resourceId: id, actor: 'visitor' })
      return next
    })
  }, [])

  const addRecent = useCallback((id: string) => {
    setRecent((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, 12)
      persist('garimpo:recent', next)
      return next
    })
    platformServices.tracker.track({ name: 'product_viewed', resource: 'product', resourceId: id, actor: 'visitor' })
  }, [])

  const clearRecent = useCallback(() => { setRecent([]); persist('garimpo:recent', []) }, [])
  const setConsent = useCallback((value: boolean) => {
    const next = value ? { essential: true as const, analytics: true, personalization: true, marketing: true } : defaultCookies
    setConsentState(value)
    setCookiePreferences(next)
    localStorage.setItem('garimpo:consent', String(value))
    persist('garimpo:cookie-preferences', next)
  }, [])
  const saveCookiePreferences = useCallback((value: CookiePreferences) => {
    const accepted = value.analytics || value.personalization || value.marketing
    setCookiePreferences(value)
    setConsentState(accepted)
    persist('garimpo:cookie-preferences', value)
    localStorage.setItem('garimpo:consent', String(accepted))
  }, [])
  const savePreferences = useCallback((value: UserPreferences) => {
    setPreferences(value)
    persist('garimpo:user-preferences', value)
    platformServices.tracker.track({ name: 'preferences_updated', resource: 'user', actor: 'visitor' })
  }, [])
  const saveSearch = useCallback((query: string) => {
    if (!query.trim()) return
    setSavedSearches((current) => {
      const next = [query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 8)
      persist('garimpo:saved-searches', next)
      return next
    })
  }, [])
  const removeSavedSearch = useCallback((query: string) => {
    setSavedSearches((current) => {
      const next = current.filter((item) => item !== query)
      persist('garimpo:saved-searches', next)
      return next
    })
  }, [])

  const value = useMemo<MockState>(() => ({
    hydrated, favorites, recent, compare, consent, cookiePreferences, preferences, savedSearches,
    toggleFavorite, toggleCompare, addRecent, clearRecent, clearHistory: clearRecent, setConsent, saveCookiePreferences,
    savePreferences, saveSearch, removeSavedSearch,
  }), [hydrated, favorites, recent, compare, consent, cookiePreferences, preferences, savedSearches, toggleFavorite, toggleCompare, addRecent, clearRecent, setConsent, saveCookiePreferences, savePreferences, saveSearch, removeSavedSearch])

  return <MockContext.Provider value={value}>{children}</MockContext.Provider>
}

export function useMock() {
  const context = useContext(MockContext)
  if (!context) throw new Error('useMock deve ser usado dentro de MockProvider')
  return context
}
