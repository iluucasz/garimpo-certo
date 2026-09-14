# Dicionário de dados

| Entidade | Campos centrais | Retenção / regras |
|---|---|---|
| Product | id, slug, brand, category, attributes, status | Fonte canônica; sem preço |
| Offer | product_id, provider_id, external_id, money, stock, affiliate_url | Unique por provider/external_id |
| AffiliateClick | click_id, offer_id, slot, campaign, experiment, session_id | Sub IDs nunca contêm PII |
| AffiliateConversion | provider_conversion_id, click_id, amount, commission, currency, status | Pending não é receita realizada |
| CommissionTransaction | conversion_id, status, amount, validated_at, paid_at | Ledger auditável |
| RecommendationSnapshot | slot, input_hash, algorithm_version, candidates, scores, expires_at | Reproduzível e cacheado |
| ExperimentAssignment | experiment_id, subject_id, variant, assignment_id | Sticky e determinístico |
| AnalyticsEvent | name, anonymous_id, properties, occurred_at, consent_version | 90 dias no padrão inicial |
| AuditLog | actor, action, resource, before_redacted, after_redacted, occurred_at | Append-only; nunca armazena secrets |

Valores monetários são representados por quantidade e moeda, inicialmente `BRL`, sem assumir moeda global. Timestamps persistidos usam UTC e são apresentados em `America/Sao_Paulo`.
