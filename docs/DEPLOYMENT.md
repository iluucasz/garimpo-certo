# Deploy e operação

## Gates

A promoção exige typecheck, testes unitários/integração, E2E desktop/mobile, axe, build e smoke checks em `/api/health`, `/api/ready`, homepage, busca, produto e admin. Budgets: p95 de API mock abaixo de 500 ms em carga leve; LCP abaixo de 2,5 s; CLS abaixo de 0,1; INP abaixo de 200 ms; erro HTTP abaixo de 1%.

## Estratégia

Preview valida migrations e contratos antes do tráfego. Em produção, migrations compatíveis são aplicadas antes da aplicação; mudanças destrutivas usam expand/contract. Rollback aponta para a versão anterior e feature flags interrompem recursos novos sem redeploy.

## Observabilidade

Requests propagam `request_id` e `trace_id`; jobs incluem `job_id`; adapters registram provider, endpoint, duração, status e retry_count. Alertas mínimos: readiness indisponível, circuit breaker aberto, fila crescendo, erro acima de 1%, webhook rejeitado e queda anormal de atribuição.

O script `load-tests/core-journeys.js` cobre navegação, recomendação e ingestão com k6. Integrações reais, banco e autenticação permanecem fora do modo mock e devem ser conectados antes do go-live.
