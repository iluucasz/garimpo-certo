# Taxonomia de eventos

## Envelopes

Eventos de domínio usam `id`, `type`, `aggregateId`, `occurredAt`, `schemaVersion` e `payload`. Eventos analíticos usam `id`, `name`, `resource`, `resourceId`, `actor/anonymousId`, `timestamp`, `schemaVersion` e propriedades sem PII.

## Domínio

| Evento | Produtor | Consumidor | Idempotência |
|---|---|---|---|
| ProductCreated / ProductUpdated | Catalog | Search, recommendation, audit | aggregate + version |
| OfferUpdated / PriceChanged | Provider ingestion | Cache, price history | provider + external ID + timestamp |
| AffiliateClicked | Affiliate | Attribution, analytics | click ID |
| ConversionReceived | Webhook | Commission ledger | provider conversion ID |
| FavoriteAdded | Identity | Profile, recommendation | user + product |

## Analytics

`page_view`, `search`, `product_view`, `favorite_add`, `compare_add`, `recommendation_impression`, `recommendation_click`, `affiliate_click`, `conversion`, `consent_updated` e `experiment_exposure`. Eventos não essenciais só são emitidos com consentimento adequado; `experiment_exposure` inclui assignment sticky, variante e versão do algoritmo.

O mock mantém eventos em memória/local storage. Produção usa outbox transacional para fatos críticos, fila retryable e dead-letter review após falhas permanentes.
