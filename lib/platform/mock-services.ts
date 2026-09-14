'use client'

import { generateRecommendations } from '@/lib/recommendation/engine'
import type {
  EventTracker,
  JobRun,
  PlatformServices,
  ProviderAdapter,
  RecommendationEngine,
  TrackingEvent,
} from './contracts'

const tracker: EventTracker = {
  track(input) {
    fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: eventTypeFor(input.name), aggregateId: input.resourceId ?? input.resource, payload: { name: input.name, actor: input.actor, ...input.metadata } }),
    }).catch(() => {})
  },
  list: () => [],
}

function eventTypeFor(name: string): TrackingEvent['name'] {
  if (name.includes('favorite')) return 'FavoriteAdded'
  return 'ProductUpdated'
}

const recommendation: RecommendationEngine = {
  recommend({ productIds, category, limit = 6, seed = 'garimpo' }) {
    return generateRecommendations({ exclude: productIds, category, limit, seed }).recommendations.map((item) => item.product.id)
  },
}

// TODO: buscar via /api/v1/providers em vez de fixar a lista — hoje só há "shopee" seedado no Neon.
function createAdapter(key: string, name: string): ProviderAdapter {
  return {
    key,
    name,
    async health() {
      const response = await fetch('/api/v1/providers').catch(() => null)
      return response?.ok ? 'healthy' : 'offline'
    },
    async sync(): Promise<JobRun> {
      const response = await fetch(`/api/v1/providers/${key}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ items: [] }),
      })
      const body = await response.json()
      const job = body.data?.job as { id: string; createdAt: string } | undefined
      return {
        id: job?.id ?? crypto.randomUUID(),
        job: 'Sincronização de catálogo',
        provider: name,
        status: response.ok ? 'running' : 'failed',
        progress: response.ok ? 12 : 0,
        processed: 0,
        errors: response.ok ? 0 : 1,
        startedAt: job?.createdAt ?? new Date().toISOString(),
      }
    },
  }
}

export const platformServices: PlatformServices = {
  mode: 'real',
  tracker,
  recommendation,
  adapters: [createAdapter('shopee', 'Shopee')],
}
