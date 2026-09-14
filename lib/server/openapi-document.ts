const json = (schema: object, description = 'Operação concluída') => ({ description, content: { 'application/json': { schema } } })
const envelope = (data: object) => ({ type: 'object', required: ['data', 'meta'], properties: { data, meta: { $ref: '#/components/schemas/Meta' } } })
const errorResponses = { '400': { $ref: '#/components/responses/BadRequest' }, '403': { $ref: '#/components/responses/Forbidden' }, '404': { $ref: '#/components/responses/NotFound' }, '409': { $ref: '#/components/responses/Conflict' }, '422': { $ref: '#/components/responses/ValidationError' }, '428': { $ref: '#/components/responses/PreconditionRequired' }, '429': { $ref: '#/components/responses/RateLimited' } }

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Garimpo Platform API',
    version: '2.0.0',
    description: 'Contrato executável da plataforma, sobre Neon Postgres. Autenticação via sessão Better Auth (cookie).',
  },
  servers: [{ url: '/api/v1', description: 'Servidor local Next.js' }],
  tags: [
    { name: 'Catálogo' }, { name: 'Ingestão' }, { name: 'Eventos' }, { name: 'Operações' }, { name: 'Inteligência' }, { name: 'Webhooks' },
  ],
  paths: {
    '/products': {
      get: { tags: ['Catálogo'], summary: 'Lista e pesquisa produtos', parameters: [
        { name: 'q', in: 'query', schema: { type: 'string' } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': json(envelope({ type: 'array', items: { $ref: '#/components/schemas/Product' } })) } },
      post: { tags: ['Catálogo'], summary: 'Cria produto', security: [{ mockRole: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } }, responses: { '201': json(envelope({ $ref: '#/components/schemas/Product' }), 'Produto criado'), ...errorResponses } },
    },
    '/products/{id}': {
      parameters: [{ $ref: '#/components/parameters/ResourceId' }],
      get: { tags: ['Catálogo'], summary: 'Obtém produto', responses: { '200': json(envelope({ $ref: '#/components/schemas/Product' })), '404': errorResponses['404'] } },
      patch: { tags: ['Catálogo'], summary: 'Atualiza parcialmente um produto', security: [{ mockRole: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductPatch' } } } }, responses: { '200': json(envelope({ $ref: '#/components/schemas/Product' })), ...errorResponses } },
      delete: { tags: ['Catálogo'], summary: 'Exclui produto', security: [{ mockRole: [] }], responses: { '200': json(envelope({ type: 'object', properties: { deleted: { type: 'boolean' } } })), ...errorResponses } },
    },
    '/offers': { get: { tags: ['Catálogo'], summary: 'Lista ofertas normalizadas', responses: { '200': json(envelope({ type: 'array', items: { $ref: '#/components/schemas/Offer' } })) } } },
    '/providers': { get: { tags: ['Ingestão'], summary: 'Lista providers e capabilities', responses: { '200': json(envelope({ type: 'array', items: { $ref: '#/components/schemas/Provider' } })) } } },
    '/providers/{provider}/sync': {
      post: { tags: ['Ingestão'], summary: 'Executa importação idempotente', security: [{ mockRole: [] }], parameters: [
        { name: 'provider', in: 'path', required: true, schema: { type: 'string', example: 'shopee' } },
        { $ref: '#/components/parameters/IdempotencyKey' },
      ], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/ProviderProduct' } } } } } } }, responses: { '200': json(envelope({ $ref: '#/components/schemas/SyncResult' })), ...errorResponses } },
    },
    '/matching': { post: { tags: ['Ingestão'], summary: 'Calcula candidatos canônicos', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProviderProduct' } } } }, responses: { '200': json(envelope({ type: 'array', items: { $ref: '#/components/schemas/MatchCandidate' } })), ...errorResponses } } },
    '/events': {
      get: { tags: ['Eventos'], summary: 'Lista domain events', responses: { '200': json(envelope({ type: 'array', items: { $ref: '#/components/schemas/DomainEvent' } })) } },
      post: { tags: ['Eventos'], summary: 'Publica domain event', parameters: [{ $ref: '#/components/parameters/IdempotencyKeyOptional' }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DomainEventInput' } } } }, responses: { '202': json(envelope({ $ref: '#/components/schemas/DomainEvent' }), 'Evento aceito'), ...errorResponses } },
    },
    '/jobs': {
      get: { tags: ['Operações'], summary: 'Lista fila de jobs', responses: { '200': json(envelope({ type: 'array', items: { $ref: '#/components/schemas/Job' } })) } },
      post: { tags: ['Operações'], summary: 'Agenda job', security: [{ mockRole: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['topic'], properties: { topic: { type: 'string' }, payload: { type: 'object', additionalProperties: true } } } } } }, responses: { '202': json(envelope({ $ref: '#/components/schemas/Job' }), 'Job agendado'), ...errorResponses } },
    },
    '/jobs/{id}/process': { post: { tags: ['Operações'], summary: 'Processa job pendente', security: [{ mockRole: [] }], parameters: [{ $ref: '#/components/parameters/ResourceId' }], responses: { '200': json(envelope({ $ref: '#/components/schemas/Job' })), ...errorResponses } } },
    '/cache': {
      get: { tags: ['Operações'], summary: 'Obtém métricas do cache mock', responses: { '200': json(envelope({ $ref: '#/components/schemas/CacheStats' })) } },
      delete: { tags: ['Operações'], summary: 'Invalida namespace de cache', security: [{ mockRole: [] }], parameters: [{ name: 'prefix', in: 'query', schema: { type: 'string', default: '' } }], responses: { '200': json(envelope({ type: 'object', properties: { invalidated: { type: 'integer' } } })), ...errorResponses } },
    },
    '/recommendations': { get: { tags: ['Inteligência'], summary: 'Gera snapshot versionado com candidate generation, scoring e re-ranking', parameters: [
      { name: 'slot', in: 'query', schema: { type: 'string', example: 'home_for_you' } },
      { name: 'seed', in: 'query', schema: { type: 'string' } },
      { name: 'category', in: 'query', schema: { type: 'string' } },
      { name: 'productId', in: 'query', schema: { type: 'string' } },
      { name: 'exclude', in: 'query', schema: { type: 'string', description: 'IDs separados por vírgula' } },
      { name: 'explorationRate', in: 'query', schema: { type: 'number', minimum: 0, maximum: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20 } },
    ], responses: { '200': json(envelope({ $ref: '#/components/schemas/RecommendationSnapshot' })), ...errorResponses } } },
    '/outbound-clicks': {
      get: { tags: ['Inteligência'], summary: 'Retorna ledger de atribuição (sem filtros)', responses: { '200': json(envelope({ $ref: '#/components/schemas/AttributionReport' })) } },
      post: { tags: ['Inteligência'], summary: 'Registra clique afiliado com sub_id seguro', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AffiliateClickInput' } } } }, responses: { '201': json(envelope({ $ref: '#/components/schemas/AffiliateClick' })), ...errorResponses } },
    },
    '/operations': { get: { tags: ['Operações'], summary: 'Status interno, circuit breakers e logs estruturados', security: [{ mockRole: [] }], responses: { '200': json(envelope({ $ref: '#/components/schemas/OperationsStatus' })), ...errorResponses } } },
    '/analytics/rollups': { get: { tags: ['Inteligência'], summary: 'Retorna rollups analíticos com cache', parameters: [{ name: 'range', in: 'query', schema: { type: 'string', enum: ['24h', '7d', '30d'] } }], responses: { '200': json(envelope({ $ref: '#/components/schemas/AnalyticsRollup' })) } } },
    '/webhooks/conversions': { post: { tags: ['Webhooks'], summary: 'Recebe conversão assinada e idempotente', parameters: [
      { $ref: '#/components/parameters/IdempotencyKey' }, { name: 'x-mock-signature', in: 'header', required: true, schema: { type: 'string', example: 'garimpo-mock-signature' } },
    ], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Conversion' } } } }, responses: { '202': json(envelope({ $ref: '#/components/schemas/Conversion' }), 'Conversão aceita'), '401': { $ref: '#/components/responses/Unauthorized' }, ...errorResponses } } },
    '/attribution': { get: { tags: ['Inteligência'], summary: 'Relatório de atribuição (cliques, conversões, comissão)', security: [{ mockRole: [] }], parameters: [
      { name: 'providerId', in: 'query', schema: { type: 'string' } }, { name: 'slot', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } },
    ], responses: { '200': json(envelope({ $ref: '#/components/schemas/AttributionReport' })), ...errorResponses } } },
    '/openapi': { get: { tags: ['Operações'], summary: 'Retorna este contrato OpenAPI', responses: { '200': json(envelope({ type: 'object' })) } } },
  },
  components: {
    securitySchemes: { mockRole: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token', description: 'Sessão Better Auth. Papéis: OWNER, ADMIN, MARKETING, CATALOG_MANAGER, ANALYST, SUPPORT ou READ_ONLY.' } },
    parameters: {
      ResourceId: { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      IdempotencyKey: { name: 'idempotency-key', in: 'header', required: true, schema: { type: 'string', minLength: 8 } },
      IdempotencyKeyOptional: { name: 'idempotency-key', in: 'header', required: false, schema: { type: 'string', minLength: 8 } },
    },
    responses: {
      BadRequest: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Requisição inválida'),
      Unauthorized: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Assinatura inválida'),
      Forbidden: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Papel sem permissão'),
      NotFound: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Recurso não encontrado'),
      Conflict: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Conflito com o estado atual'),
      ValidationError: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Payload semanticamente inválido'),
      PreconditionRequired: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Chave de idempotência obrigatória'),
      RateLimited: json({ $ref: '#/components/schemas/ErrorEnvelope' }, 'Limite de requisições excedido'),
    },
    schemas: {
      Meta: { type: 'object', required: ['mode', 'timestamp'], properties: { mode: { const: 'real' }, timestamp: { type: 'string', format: 'date-time' }, replayed: { type: 'boolean' } } },
      ErrorEnvelope: { type: 'object', required: ['error', 'meta'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' }, details: { type: 'object', additionalProperties: true } } }, meta: { $ref: '#/components/schemas/Meta' } } },
      ProductInput: { type: 'object', required: ['name', 'slug'], properties: { name: { type: 'string', minLength: 2 }, slug: { type: 'string', pattern: '^[a-z0-9-]+$' }, brandId: { type: 'string', format: 'uuid' }, categoryId: { type: 'string', format: 'uuid' }, description: { type: 'string' }, status: { type: 'string', enum: ['active', 'unavailable', 'discontinued', 'removed'] } } },
      ProductPatch: { type: 'object', minProperties: 1, properties: { name: { type: 'string', minLength: 2 }, brandId: { type: 'string', format: 'uuid' }, description: { type: 'string' }, status: { type: 'string', enum: ['active', 'unavailable', 'discontinued', 'removed'] } } },
      Product: { type: 'object', required: ['id', 'slug', 'name', 'status'], properties: { id: { type: 'string' }, slug: { type: 'string' }, name: { type: 'string' }, description: { type: 'string', nullable: true }, status: { type: 'string' }, brand: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } } }, category: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } } }, images: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } } } },
      Offer: { type: 'object', required: ['id', 'productId', 'providerId', 'price'], properties: { id: { type: 'string' }, productId: { type: 'string' }, providerId: { type: 'string' }, price: { type: 'number' }, originalPrice: { type: 'number', nullable: true }, availability: { type: 'string' }, status: { type: 'string' }, url: { type: 'string', format: 'uri' } } },
      Provider: { type: 'object', required: ['id', 'name', 'status'], properties: { id: { type: 'string' }, name: { type: 'string' }, status: { type: 'string' }, capabilities: { type: 'array', items: { type: 'string' } } } },
      ProviderProduct: { type: 'object', required: ['externalId', 'title', 'price'], properties: { externalId: { type: 'string' }, title: { type: 'string' }, brand: { type: 'string' }, category: { type: 'string' }, price: { type: 'number', minimum: 0 }, url: { type: 'string', format: 'uri' } } },
      MatchCandidate: { type: 'object', required: ['productId', 'confidence'], properties: { productId: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 }, signals: { type: 'array', items: { type: 'string' } } } },
      SyncResult: { type: 'object', properties: { provider: { type: 'string' }, received: { type: 'integer' }, normalized: { type: 'integer' }, matched: { type: 'integer' }, queued: { type: 'integer' }, replayed: { type: 'boolean' } } },
      DomainEventInput: { type: 'object', required: ['type', 'aggregateId'], properties: { type: { type: 'string' }, aggregateId: { type: 'string' }, payload: { type: 'object', additionalProperties: true } } },
      DomainEvent: { allOf: [{ $ref: '#/components/schemas/DomainEventInput' }, { type: 'object', required: ['id', 'occurredAt'], properties: { id: { type: 'string' }, occurredAt: { type: 'string', format: 'date-time' } } }] },
      Job: { type: 'object', required: ['id', 'topic', 'status'], properties: { id: { type: 'string' }, topic: { type: 'string' }, status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] }, attempts: { type: 'integer' }, payload: { type: 'object', additionalProperties: true } } },
      CacheStats: { type: 'object', properties: { size: { type: 'integer' }, hits: { type: 'integer' }, misses: { type: 'integer' } } },
      AnalyticsRollup: { type: 'object', properties: { range: { type: 'string' }, sessions: { type: 'integer' }, searches: { type: 'integer' }, productViews: { type: 'integer' }, affiliateClicks: { type: 'integer' }, conversionRate: { type: 'number' } } },
      RecommendationSnapshot: { type: 'object', required: ['id','algorithmVersion','recommendations','diagnostics'], properties: { id: { type:'string' }, slot: { type:'string' }, algorithmVersion: { type:'string' }, generatedAt: { type:'string',format:'date-time' }, expiresAt: { type:'string',format:'date-time' }, cache: { type:'string',enum:['HIT','MISS'] }, recommendations: { type:'array',items:{ type:'object',properties:{ product:{$ref:'#/components/schemas/Product'},score:{type:'number'},reasonCode:{type:'string'},reason:{type:'string'},sources:{type:'array',items:{type:'string'}},explored:{type:'boolean'} } } }, diagnostics: { type:'object',properties:{ candidates:{type:'integer'},filtered:{type:'integer'},explorationCount:{type:'integer'} } } } },
      AffiliateClickInput: { type:'object',required:['offerId','sessionId'],properties:{ offerId:{type:'string'},sessionId:{type:'string'},slot:{type:'string'},campaign:{type:'string'},experiment:{type:'string'} } },
      AffiliateClick: { type:'object',properties:{id:{type:'string'},clickId:{type:'string'},offerId:{type:'string'},subId:{type:'string'},recommendationSlotId:{type:'string',nullable:true},createdAt:{type:'string',format:'date-time'}} },
      AttributionReport: { type:'object',properties:{clicks:{type:'array',items:{$ref:'#/components/schemas/AffiliateClick'}},conversions:{type:'array',items:{$ref:'#/components/schemas/Conversion'}},metrics:{type:'object',additionalProperties:true}} },
      OperationsStatus: { type:'object',properties:{health:{type:'object',additionalProperties:true},logs:{type:'array',items:{type:'object',additionalProperties:true}},circuits:{type:'array',items:{type:'object',additionalProperties:true}}} },
      Conversion: { type: 'object', required: ['conversionId', 'clickId', 'amount', 'provider'], properties: { conversionId: { type: 'string' }, clickId: { type: 'string' }, amount: { type: 'number', minimum: 0 }, provider: { type: 'string' } } },
    },
  },
} as const
