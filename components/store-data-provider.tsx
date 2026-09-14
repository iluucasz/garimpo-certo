'use client'

import { createContext, useContext, useMemo } from 'react'
import type { StoreCatalog } from '@/lib/db/repositories/store-catalog'
import type { Offer, Product } from '@/lib/types'

interface StoreDataState extends StoreCatalog {
  getProduct: (slug: string) => Product | undefined
  getOffers: (productId: string) => Offer[]
  getBestOffer: (productId: string) => Offer | undefined
  getProvider: (providerId: string) => { id: string; name: string; slug: string; rating: number; verified: boolean; color: string }
}

const StoreDataContext = createContext<StoreDataState | null>(null)

export function StoreDataProvider({ data, children }: { data: StoreCatalog; children: React.ReactNode }) {
  const value = useMemo<StoreDataState>(() => {
    const getOffers = (productId: string) => data.offers.filter((offer) => offer.productId === productId).sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping))
    return {
      ...data,
      getProduct: (slug) => data.products.find((product) => product.slug === slug),
      getOffers,
      getBestOffer: (productId) => getOffers(productId).find((offer) => offer.stock !== 'indisponível'),
      getProvider: (providerId) => data.providers.find((provider) => provider.id === providerId)!,
    }
  }, [data])

  return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>
}

export function useStoreData() {
  const context = useContext(StoreDataContext)
  if (!context) throw new Error('useStoreData deve ser usado dentro de StoreDataProvider')
  return context
}
