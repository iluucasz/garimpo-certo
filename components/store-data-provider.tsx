'use client'

import { createContext, useContext, useMemo } from 'react'
import type { StoreCatalog } from '@/lib/db/repositories/store-catalog'
import { defaultCatalogRules, type CatalogRules } from '@/lib/catalog/rules'
import type { Offer, Product, ProductMetrics } from '@/lib/types'

/** Pesos e exploração do ranking e configuração dos slots, vindos do painel (Experiência → Ranking e Slots). */
export type RankingSettings = Record<string, unknown>

interface StoreDataState extends StoreCatalog {
  metrics: Record<string, ProductMetrics>
  ranking: RankingSettings
  slots: Record<string, unknown>
  /** Limiares das coleções e dos filtros (Painel → Regras do catálogo). */
  rules: CatalogRules
  getProduct: (slug: string) => Product | undefined
  getOffers: (productId: string) => Offer[]
  getBestOffer: (productId: string) => Offer | undefined
  getProvider: (providerId: string) => { id: string; name: string; slug: string; rating: number; verified: boolean; color: string }
}

const StoreDataContext = createContext<StoreDataState | null>(null)

export function StoreDataProvider({ data, metrics = {}, ranking = {}, slots = {}, rules = defaultCatalogRules, children }: { data: StoreCatalog; metrics?: Record<string, ProductMetrics>; ranking?: RankingSettings; slots?: Record<string, unknown>; rules?: CatalogRules; children: React.ReactNode }) {
  const value = useMemo<StoreDataState>(() => {
    const getOffers = (productId: string) => data.offers.filter((offer) => offer.productId === productId).sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping))
    return {
      ...data,
      metrics,
      ranking,
      slots,
      rules,
      getProduct: (slug) => data.products.find((product) => product.slug === slug),
      getOffers,
      getBestOffer: (productId) => getOffers(productId).find((offer) => offer.stock !== 'indisponível'),
      getProvider: (providerId) => data.providers.find((provider) => provider.id === providerId)!,
    }
  }, [data, metrics, ranking, slots, rules])

  return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>
}

export function useStoreData() {
  const context = useContext(StoreDataContext)
  if (!context) throw new Error('useStoreData deve ser usado dentro de StoreDataProvider')
  return context
}
