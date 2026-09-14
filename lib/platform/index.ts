export type {
  EntityId,
  EventTracker,
  FeatureFlag,
  JobRun,
  ListQuery,
  ListResult,
  PlatformRecord,
  PlatformServices,
  ProviderAdapter,
  RecommendationEngine,
  Repository,
  TrackingEvent,
} from './contracts'
export { LocalRepository } from './local-repository'
export { platformServices } from './mock-services'

/**
 * Ponto único de troca para integrações reais.
 * Substitua `platformServices` e as implementações de `Repository` por adapters
 * de API/DB sem alterar os componentes consumidores.
 */
