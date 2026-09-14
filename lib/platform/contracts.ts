'use client'

export type EntityId = string
export type RecordValue = string | number | boolean

export interface PlatformRecord {
  id: EntityId
  [key: string]: RecordValue
}

export interface ListQuery {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Repository<T extends PlatformRecord> {
  list(query?: ListQuery): Promise<ListResult<T>>
  get(id: EntityId): Promise<T | null>
  create(input: Omit<T, 'id'>): Promise<T>
  update(id: EntityId, patch: Partial<Omit<T, 'id'>>): Promise<T>
  remove(id: EntityId): Promise<void>
}

export interface TrackingEvent {
  id: string
  name: string
  resource: string
  resourceId?: string
  actor: string
  timestamp: string
  metadata?: Record<string, RecordValue>
}

export interface EventTracker {
  track(event: Omit<TrackingEvent, 'id' | 'timestamp'>): void
  list(): TrackingEvent[]
}

export interface JobRun {
  id: string
  job: string
  provider: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  processed: number
  errors: number
  startedAt: string
}

export interface ProviderAdapter {
  key: string
  name: string
  health(): Promise<'healthy' | 'degraded' | 'offline'>
  sync(): Promise<JobRun>
}

export interface FeatureFlag {
  key: string
  label: string
  enabled: boolean
  audience: number
}

export interface RecommendationRequest {
  productIds: string[]
  category?: string
  limit?: number
  seed?: string
}

export interface RecommendationEngine {
  recommend(request: RecommendationRequest): string[]
}

export interface PlatformServices {
  mode: 'mock' | 'real'
  tracker: EventTracker
  recommendation: RecommendationEngine
  adapters: ProviderAdapter[]
}
