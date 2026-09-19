'use client'

import { createContext, useContext, useMemo } from 'react'
import type { StoreCatalog } from '@/lib/db/repositories/store-catalog'
import type { Offer, Product, ProductMetrics } from '@/lib/types'

interface StoreDataState extends StoreCatalog {
  metrics: Record<string, ProductMetrics>
  getProduct: (slug: string) => Product | undefined
  getOffers: (productId: string) => Offer[]
  getBestOffer: (productId: string) => Offer | undefined
  getProvider: (providerId: string) => { id: string; name: string; slug: string; rating: number; verified: boolean; color: string }
}

const StoreDataContext = createContext<StoreDataState | null>(null)

export function StoreDataProvider({ data, metrics = {}, children }: { data: StoreCatalog; metrics?: Record<string, ProductMetrics>; children: React.ReactNode }) {
  const value = useMemo<StoreDataState>(() => {
    const getOffers = (productId: string) => data.offers.filter((offer) => offer.productId === productId).sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping))
    return {
      ...data,
      metrics,
      getProduct: (slug) => data.products.find((product) => product.slug === slug),
      getOffers,
      getBestOffer: (productId) => getOffers(productId).find((offer) => offer.stock !== 'indisponível'),
      getProvider: (providerId) => data.providers.find((provider) => provider.id === providerId)!,
    }
  }, [data, metrics])

  return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>
}

export function useStoreData() {
  const context = useContext(StoreDataContext)
  if (!context) throw new Error('useStoreData deve ser usado dentro de StoreDataProvider')
  return context
}
