/**
 * Metadados dos recursos administráveis. Isomórfico: o painel desenha tabela e formulário a partir daqui e a
 * API usa os mesmos campos para validar. Nenhum dado de exemplo mora neste arquivo.
 */
import type { Permission } from '@/lib/auth/rbac'

export type ResourceSlug =
  | 'produtos' | 'ofertas' | 'providers' | 'categorias' | 'marcas' | 'tags' | 'colecoes'
  | 'campanhas' | 'cms' | 'paginas' | 'cupons' | 'segmentos' | 'flags'
  | 'usuarios' | 'lgpd' | 'audit-log' | 'sessoes' | 'importacoes'

export type Option = { value: string; label: string }
export type Lookup = 'categories' | 'brands' | 'tags' | 'products' | 'roles'

export type ResourceField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'datetime' | 'url' | 'multi' | 'products' | 'rules' | 'markdown' | 'json'
  required?: boolean
  help?: string
  placeholder?: string
  maxLength?: number
  min?: number
  max?: number
  options?: Option[]
  lookup?: Lookup
  /** Mostra o valor, mas não aceita edição. */
  readOnly?: boolean
  /** Só aparece no formulário, não na tabela. */
  formOnly?: boolean
  /** Só aparece na tabela/leitura, não no formulário. */
  listOnly?: boolean
  /** Só pode ser definido na criação. */
  createOnly?: boolean
  /** Campo de URL de imagem: mostra o botão de enviar arquivo ao lado. */
  upload?: boolean
}

export type ResourceMeta = {
  slug: ResourceSlug
  title: string
  singular: string
  description: string
  read: Permission
  write: Permission
  fields: ResourceField[]
  create: boolean
  remove: false | 'delete' | 'archive'
  createLabel: string
  searchPlaceholder: string
  /** Campo (de `fields`) usado como filtro rápido por valor. */
  filter?: { key: string; label: string; options: Option[] }
  /** Endereço público do registro, quando existe. Recebe a linha. */
  publicPath?: string
  emptyText: string
}

const status = (options: Option[]) => options
export const publishStatuses = status([{ value: 'draft', label: 'Rascunho' }, { value: 'published', label: 'Publicado' }])
export const campaignStatuses = status([{ value: 'draft', label: 'Rascunho' }, { value: 'active', label: 'Ativa' }, { value: 'archived', label: 'Arquivada' }])
export const productStatuses = status([
  { value: 'active', label: 'Ativo' },
  { value: 'unavailable', label: 'Indisponível' },
  { value: 'discontinued', label: 'Descontinuado' },
  { value: 'removed', label: 'Oculto' },
])

export const segmentRuleTypes: { value: string; label: string; kind: 'number' | 'text'; unit?: string; help: string }[] = [
  { value: 'min_clicks', label: 'Clicou para comprar pelo menos', kind: 'number', unit: 'vezes', help: 'Quantidade mínima de cliques nos botões de compra.' },
  { value: 'category', label: 'Clicou em produto da categoria', kind: 'text', help: 'Endereço (slug) da categoria, ex.: tecnologia.' },
  { value: 'min_price', label: 'Clicou em produto a partir de', kind: 'number', unit: 'R$', help: 'Preço da oferta clicada.' },
  { value: 'max_price', label: 'Clicou em produto de até', kind: 'number', unit: 'R$', help: 'Preço da oferta clicada.' },
  { value: 'slot', label: 'Clicou a partir do local', kind: 'text', help: 'Local do botão na página, ex.: product-detail.' },
]

export const resources: Record<ResourceSlug, ResourceMeta> = {
  produtos: {
    slug: 'produtos', title: 'Produtos', singular: 'produto',
    description: 'Produtos vindos da Shopee. Editar um produto o protege da importação diária: nome, categorias e tags passam a ser seus.',
    read: 'catalog:read', write: 'catalog:write', create: false, remove: 'archive',
    createLabel: '', searchPlaceholder: 'Buscar por nome ou endereço', emptyText: 'Nenhum produto encontrado. Rode a importação em Importações.',
    filter: { key: 'status', label: 'Situação', options: productStatuses },
    publicPath: '/produto/{slug}',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 200 },
      { key: 'brandName', label: 'Loja', type: 'text', readOnly: true, listOnly: true },
      { key: 'status', label: 'Situação', type: 'select', options: productStatuses, required: true, help: '“Oculto” tira o produto da vitrine, das coleções e da busca.' },
      { key: 'categoryIds', label: 'Categorias', type: 'multi', lookup: 'categories', formOnly: true },
      { key: 'categories', label: 'Categorias', type: 'text', readOnly: true, listOnly: true },
      { key: 'tagIds', label: 'Selos (tags)', type: 'multi', lookup: 'tags', formOnly: true, help: 'Selos aparecem no cartão do produto. “Escolha do editor” é um bom destaque manual.' },
      { key: 'description', label: 'Descrição', type: 'textarea', maxLength: 2000, formOnly: true },
      { key: 'price', label: 'Preço', type: 'text', readOnly: true, listOnly: true },
      { key: 'soldCount', label: 'Vendas', type: 'text', readOnly: true, listOnly: true },
      { key: 'editorialLocked', label: 'Protegido da importação', type: 'boolean', help: 'Ligado, a importação diária não sobrescreve nome, situação, categorias e tags.' },
      { key: 'slug', label: 'Endereço', type: 'text', readOnly: true, formOnly: true },
    ],
  },
  ofertas: {
    slug: 'ofertas', title: 'Ofertas', singular: 'oferta',
    description: 'Preço e link de cada loja para cada produto, como recebidos da Shopee.',
    read: 'catalog:read', write: 'catalog:write', create: false, remove: false,
    createLabel: '', searchPlaceholder: 'Buscar por produto ou loja', emptyText: 'Nenhuma oferta encontrada.',
    filter: { key: 'status', label: 'Situação', options: [{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }, { value: 'removed', label: 'Removida' }] },
    fields: [
      { key: 'productName', label: 'Produto', type: 'text', readOnly: true },
      { key: 'providerName', label: 'Origem', type: 'text', readOnly: true },
      { key: 'sellerName', label: 'Loja', type: 'text', readOnly: true },
      { key: 'price', label: 'Preço', type: 'text', readOnly: true },
      { key: 'commission', label: 'Comissão', type: 'text', readOnly: true },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }, { value: 'removed', label: 'Removida' }], help: 'Inativa ou removida tira a oferta do site sem apagar o histórico.' },
      { key: 'syncedAt', label: 'Sincronizada em', type: 'datetime', readOnly: true },
    ],
  },
  providers: {
    slug: 'providers', title: 'Provedores', singular: 'provedor',
    description: 'Fontes de produtos e de links de afiliado. Hoje a Shopee é a única integrada.',
    read: 'catalog:read', write: 'settings:write', create: false, remove: false,
    createLabel: '', searchPlaceholder: 'Buscar provedor', emptyText: 'Nenhum provedor cadastrado.',
    fields: [
      { key: 'displayName', label: 'Nome', type: 'text', required: true, maxLength: 80 },
      { key: 'code', label: 'Código', type: 'text', readOnly: true },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'active', label: 'Ativo' }, { value: 'degraded', label: 'Instável' }, { value: 'disabled', label: 'Desligado' }] },
      { key: 'offers', label: 'Ofertas ativas', type: 'text', readOnly: true },
      { key: 'syncedAt', label: 'Última sincronização', type: 'datetime', readOnly: true },
    ],
  },
  categorias: {
    slug: 'categorias', title: 'Categorias', singular: 'categoria',
    description: 'Taxonomia da vitrine. Cada categoria gera uma página, um guia de compra e a coleção “Mais vendidos em …”.',
    read: 'catalog:read', write: 'catalog:write', create: true, remove: 'delete',
    createLabel: 'Nova categoria', searchPlaceholder: 'Buscar categoria', emptyText: 'Nenhuma categoria. Elas nascem da importação ou podem ser criadas aqui.',
    publicPath: '/categorias/{slug}',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 60 },
      { key: 'slug', label: 'Endereço (slug)', type: 'text', required: true, maxLength: 60, help: 'Só letras minúsculas, números e hífen. Vira /categorias/<slug>.', createOnly: true },
      { key: 'sortOrder', label: 'Ordem', type: 'number', min: 0, max: 999, help: 'Menor aparece primeiro no menu.' },
      { key: 'products', label: 'Produtos', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  marcas: {
    slug: 'marcas', title: 'Lojas e marcas', singular: 'marca',
    description: 'Na Shopee a “marca” é a loja que vende. Duplicidades podem ser unificadas.',
    read: 'catalog:read', write: 'catalog:write', create: true, remove: 'delete',
    createLabel: 'Nova marca', searchPlaceholder: 'Buscar marca ou loja', emptyText: 'Nenhuma marca cadastrada.',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 120 },
      { key: 'slug', label: 'Endereço (slug)', type: 'text', required: true, maxLength: 120, createOnly: true },
      { key: 'products', label: 'Produtos', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  tags: {
    slug: 'tags', title: 'Selos (tags)', singular: 'selo',
    description: 'Sinais que aparecem nos cartões de produto e alimentam filtros. Alguns nascem dos números da Shopee a cada importação.',
    read: 'catalog:read', write: 'catalog:write', create: true, remove: 'delete',
    createLabel: 'Novo selo', searchPlaceholder: 'Buscar selo', emptyText: 'Nenhum selo cadastrado.',
    fields: [
      { key: 'label', label: 'Texto exibido', type: 'text', required: true, maxLength: 40 },
      { key: 'code', label: 'Código', type: 'text', required: true, maxLength: 40, createOnly: true, help: 'Identificador interno, em minúsculas e sem espaços.' },
      { key: 'products', label: 'Produtos', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  colecoes: {
    slug: 'colecoes', title: 'Coleções manuais', singular: 'coleção',
    description: 'Seleções montadas por você, em ordem. Aparecem em /colecoes quando publicadas e com pelo menos 3 produtos ativos.',
    read: 'catalog:read', write: 'content:write', create: true, remove: 'delete',
    createLabel: 'Nova coleção', searchPlaceholder: 'Buscar coleção', emptyText: 'Nenhuma coleção manual ainda. As coleções automáticas aparecem em /colecoes.',
    filter: { key: 'status', label: 'Situação', options: publishStatuses },
    publicPath: '/colecoes/{slug}',
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true, maxLength: 80 },
      { key: 'slug', label: 'Endereço (slug)', type: 'text', required: true, maxLength: 60, createOnly: true },
      { key: 'tone', label: 'Frase curta', type: 'text', required: true, maxLength: 80, help: 'Aparece acima do título no cartão da coleção.' },
      { key: 'description', label: 'Descrição', type: 'textarea', maxLength: 300, required: true },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: publishStatuses },
      { key: 'productIds', label: 'Produtos (em ordem)', type: 'products', formOnly: true, help: 'A ordem aqui é a ordem na página.' },
      { key: 'count', label: 'Produtos', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  campanhas: {
    slug: 'campanhas', title: 'Campanhas', singular: 'campanha',
    description: 'Faixa de destaque na home com data de início e fim. Só aparece enquanto estiver ativa e dentro do período.',
    read: 'catalog:read', write: 'content:write', create: true, remove: 'delete',
    createLabel: 'Nova campanha', searchPlaceholder: 'Buscar campanha', emptyText: 'Nenhuma campanha. A home não mostra faixa de destaque.',
    filter: { key: 'status', label: 'Situação', options: campaignStatuses },
    fields: [
      { key: 'title', label: 'Nome interno', type: 'text', required: true, maxLength: 80 },
      { key: 'slug', label: 'Identificador', type: 'text', required: true, maxLength: 60, createOnly: true, help: 'Usado nos relatórios de cliques.' },
      { key: 'headline', label: 'Chamada', type: 'text', required: true, maxLength: 90 },
      { key: 'description', label: 'Texto de apoio', type: 'textarea', maxLength: 240, formOnly: true },
      { key: 'ctaLabel', label: 'Texto do botão', type: 'text', required: true, maxLength: 24 },
      { key: 'ctaUrl', label: 'Destino do botão', type: 'text', required: true, maxLength: 500, help: 'Um caminho do site (ex.: /colecoes/viralizou) ou um endereço https://.' },
      { key: 'imageUrl', label: 'Imagem (URL)', type: 'url', formOnly: true, upload: true },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: campaignStatuses },
      { key: 'startsAt', label: 'Começa em', type: 'datetime' },
      { key: 'endsAt', label: 'Termina em', type: 'datetime' },
      { key: 'sortOrder', label: 'Prioridade', type: 'number', min: 0, max: 999, formOnly: true, help: 'Menor número aparece primeiro quando houver mais de uma.' },
      { key: 'clicks', label: 'Cliques', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  cms: {
    slug: 'cms', title: 'Artigos', singular: 'artigo',
    description: 'Conteúdo editorial em /artigos. Publicado, entra no sitemap automaticamente.',
    read: 'catalog:read', write: 'content:write', create: true, remove: 'delete',
    createLabel: 'Novo artigo', searchPlaceholder: 'Buscar artigo', emptyText: 'Nenhum artigo escrito ainda.',
    filter: { key: 'status', label: 'Situação', options: publishStatuses },
    publicPath: '/artigos/{slug}',
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true, maxLength: 120 },
      { key: 'slug', label: 'Endereço (slug)', type: 'text', required: true, maxLength: 80, createOnly: true },
      { key: 'summary', label: 'Resumo', type: 'textarea', maxLength: 300, help: 'Aparece na lista de artigos e como descrição para buscadores.' },
      { key: 'body', label: 'Texto', type: 'markdown', required: true, formOnly: true, help: 'Aceita # título, ## subtítulo, **negrito**, *itálico*, [link](https://…), listas com - e linhas em branco entre parágrafos.' },
      { key: 'coverImageUrl', label: 'Imagem de capa (URL)', type: 'url', formOnly: true },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: publishStatuses },
      { key: 'seoTitle', label: 'Título para buscadores', type: 'text', maxLength: 70, formOnly: true },
      { key: 'seoDescription', label: 'Descrição para buscadores', type: 'textarea', maxLength: 170, formOnly: true },
      { key: 'publishedAt', label: 'Publicado em', type: 'datetime', readOnly: true },
    ],
  },
  paginas: {
    slug: 'paginas', title: 'Páginas', singular: 'página',
    description: 'Páginas institucionais em /p/<endereço>, como Contato ou Sobre. “Como funciona” e “Privacidade” continuam fixas no código.',
    read: 'catalog:read', write: 'content:write', create: true, remove: 'delete',
    createLabel: 'Nova página', searchPlaceholder: 'Buscar página', emptyText: 'Nenhuma página criada.',
    filter: { key: 'status', label: 'Situação', options: publishStatuses },
    publicPath: '/p/{slug}',
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true, maxLength: 120 },
      { key: 'slug', label: 'Endereço (slug)', type: 'text', required: true, maxLength: 80, createOnly: true },
      { key: 'summary', label: 'Resumo', type: 'textarea', maxLength: 300 },
      { key: 'body', label: 'Texto', type: 'markdown', required: true, formOnly: true, help: 'Aceita # título, ## subtítulo, **negrito**, *itálico*, [link](https://…), listas com - e linhas em branco entre parágrafos.' },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: publishStatuses },
      { key: 'seoTitle', label: 'Título para buscadores', type: 'text', maxLength: 70, formOnly: true },
      { key: 'seoDescription', label: 'Descrição para buscadores', type: 'textarea', maxLength: 170, formOnly: true },
      { key: 'publishedAt', label: 'Publicada em', type: 'datetime', readOnly: true },
    ],
  },
  cupons: {
    slug: 'cupons', title: 'Cupons', singular: 'cupom',
    description: 'A API de afiliados da Shopee não informa cupons. Cadastre os que você encontrar; as campanhas oficiais da Shopee são importadas automaticamente.',
    read: 'catalog:read', write: 'content:write', create: true, remove: 'delete',
    createLabel: 'Novo cupom', searchPlaceholder: 'Buscar por título ou código', emptyText: 'Nenhum cupom cadastrado.',
    filter: { key: 'source', label: 'Origem', options: [{ value: 'manual', label: 'Cadastrado à mão' }, { value: 'shopee_campaign', label: 'Campanha da Shopee' }] },
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true, maxLength: 100 },
      { key: 'code', label: 'Código do cupom', type: 'text', maxLength: 40, help: 'Deixe vazio quando o desconto é aplicado direto pelo link.' },
      { key: 'discountLabel', label: 'Desconto', type: 'text', maxLength: 60, placeholder: 'Ex.: R$ 10 off, 15% off, Frete grátis' },
      { key: 'minSpend', label: 'Compra mínima (R$)', type: 'number', min: 0, max: 100000, formOnly: true },
      { key: 'description', label: 'Condições', type: 'textarea', maxLength: 300, formOnly: true, help: 'Regras da Shopee: categorias válidas, limite de uso, etc.' },
      { key: 'url', label: 'Link (afiliado)', type: 'url', required: true, help: 'Cole um link s.shopee.com.br gerado pelo seu painel de afiliados.' },
      { key: 'imageUrl', label: 'Imagem (URL)', type: 'url', formOnly: true, upload: true },
      { key: 'startsAt', label: 'Válido a partir de', type: 'datetime', formOnly: true },
      { key: 'endsAt', label: 'Válido até', type: 'datetime' },
      { key: 'isActive', label: 'Exibir no site', type: 'boolean' },
      { key: 'source', label: 'Origem', type: 'text', readOnly: true, listOnly: true },
      { key: 'situation', label: 'Situação', type: 'text', readOnly: true, listOnly: true },
      { key: 'clicks7d', label: 'Cliques (7 dias)', type: 'number', readOnly: true, listOnly: true },
      { key: 'clicks30d', label: 'Cliques (30 dias)', type: 'number', readOnly: true, listOnly: true },
    ],
  },
  segmentos: {
    slug: 'segmentos', title: 'Segmentos', singular: 'segmento',
    description: 'Audiências salvas sobre os cliques de compra medidos (só visitas que permitiram a medição). O alcance é calculado na hora, em sessões.',
    read: 'analytics:read', write: 'catalog:write', create: true, remove: 'delete',
    createLabel: 'Novo segmento', searchPlaceholder: 'Buscar segmento', emptyText: 'Nenhum segmento criado.',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 80 },
      { key: 'description', label: 'Descrição', type: 'textarea', maxLength: 240 },
      { key: 'match', label: 'Combinação', type: 'select', required: true, options: [{ value: 'all', label: 'Todas as regras' }, { value: 'any', label: 'Qualquer regra' }] },
      { key: 'rules', label: 'Regras', type: 'rules', formOnly: true },
      { key: 'reach', label: 'Alcance', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  flags: {
    slug: 'flags', title: 'Recursos e experimentos', singular: 'recurso',
    description: 'Liga e desliga partes do site sem publicar uma nova versão. Só as chaves marcadas com efeito no site têm resultado visível.',
    read: 'catalog:read', write: 'settings:write', create: true, remove: 'delete',
    createLabel: 'Novo recurso', searchPlaceholder: 'Buscar recurso', emptyText: 'Nenhum recurso cadastrado.',
    fields: [
      { key: 'key', label: 'Chave', type: 'text', required: true, maxLength: 60, createOnly: true, help: 'Identificador usado no código. Ex.: cupons, comparador.' },
      { key: 'description', label: 'Descrição', type: 'textarea', maxLength: 240 },
      { key: 'enabled', label: 'Ligado', type: 'boolean' },
      { key: 'wired', label: 'Efeito no site', type: 'text', readOnly: true, listOnly: true },
    ],
  },
  usuarios: {
    slug: 'usuarios', title: 'Usuários e papéis', singular: 'usuário',
    description: 'Quem tem conta e o que cada pessoa pode fazer no painel. Contas novas entram sem papel algum.',
    read: 'users:manage', write: 'users:manage', create: false, remove: false,
    createLabel: '', searchPlaceholder: 'Buscar por nome ou e-mail', emptyText: 'Nenhum usuário.',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', readOnly: true },
      { key: 'email', label: 'E-mail', type: 'text', readOnly: true },
      { key: 'roleIds', label: 'Papéis', type: 'multi', lookup: 'roles', formOnly: true, help: 'Sem papel, a pessoa só usa a loja. Proprietário e Administrador acessam tudo.' },
      { key: 'roles', label: 'Papéis', type: 'text', readOnly: true, listOnly: true },
      { key: 'createdAt', label: 'Criado em', type: 'datetime', readOnly: true },
    ],
  },
  lgpd: {
    slug: 'lgpd', title: 'LGPD', singular: 'solicitação',
    description: 'Pedidos de titulares de dados (LGPD). Chegam pelo formulário público de /privacidade; exportação e exclusão de conta são autoatendimento em /conta. O prazo de resposta é de 15 dias.',
    read: 'users:manage', write: 'users:manage', create: false, remove: false,
    createLabel: '', searchPlaceholder: 'Buscar por e-mail', emptyText: 'Nenhuma solicitação registrada.',
    filter: { key: 'status', label: 'Situação', options: [{ value: 'pending', label: 'Pendente' }, { value: 'processing', label: 'Em andamento' }, { value: 'completed', label: 'Concluída' }, { value: 'rejected', label: 'Recusada' }] },
    fields: [
      { key: 'protocol', label: 'Protocolo', type: 'text', readOnly: true },
      { key: 'email', label: 'Titular', type: 'text', readOnly: true },
      { key: 'type', label: 'Tipo', type: 'text', readOnly: true },
      { key: 'excerpt', label: 'Pedido', type: 'text', readOnly: true, listOnly: true },
      { key: 'message', label: 'Mensagem do titular', type: 'textarea', readOnly: true, formOnly: true },
      { key: 'source', label: 'Origem', type: 'text', readOnly: true },
      { key: 'status', label: 'Situação', type: 'select', required: true, options: [{ value: 'pending', label: 'Pendente' }, { value: 'processing', label: 'Em andamento' }, { value: 'completed', label: 'Concluída' }, { value: 'rejected', label: 'Recusada' }] },
      { key: 'responseNote', label: 'Anotação interna', type: 'textarea', maxLength: 1000, formOnly: true, help: 'Só a equipe vê. Registre o que foi feito e quando respondeu ao titular.' },
      { key: 'requestedAt', label: 'Pedida em', type: 'datetime', readOnly: true },
      { key: 'completedAt', label: 'Concluída em', type: 'datetime', readOnly: true },
    ],
  },
  'audit-log': {
    slug: 'audit-log', title: 'Auditoria', singular: 'registro',
    description: 'Tudo o que foi alterado pelo painel: quem, quando, o quê e como ficou.',
    read: 'users:manage', write: 'users:manage', create: false, remove: false,
    createLabel: '', searchPlaceholder: 'Buscar por ação ou item', emptyText: 'Nenhuma ação administrativa registrada ainda.',
    fields: [
      { key: 'createdAt', label: 'Quando', type: 'datetime', readOnly: true },
      { key: 'actor', label: 'Quem', type: 'text', readOnly: true },
      { key: 'action', label: 'Ação', type: 'text', readOnly: true },
      { key: 'entity', label: 'Item', type: 'text', readOnly: true },
    ],
  },
  sessoes: {
    slug: 'sessoes', title: 'Sessões ativas', singular: 'sessão',
    description: 'Logins válidos agora. Encerrar uma sessão obriga a pessoa a entrar de novo.',
    read: 'users:manage', write: 'users:manage', create: false, remove: 'delete',
    createLabel: '', searchPlaceholder: 'Buscar por pessoa', emptyText: 'Nenhuma sessão ativa.',
    fields: [
      { key: 'who', label: 'Pessoa', type: 'text', readOnly: true },
      { key: 'device', label: 'Dispositivo', type: 'text', readOnly: true },
      { key: 'ip', label: 'IP', type: 'text', readOnly: true },
      { key: 'createdAt', label: 'Entrou em', type: 'datetime', readOnly: true },
      { key: 'expiresAt', label: 'Expira em', type: 'datetime', readOnly: true },
    ],
  },
  importacoes: {
    slug: 'importacoes', title: 'Execuções de importação', singular: 'execução',
    description: 'Histórico de cada importação do catálogo e de cada sincronização de comissões, agendada ou manual.',
    read: 'catalog:read', write: 'jobs:run', create: false, remove: false,
    createLabel: '', searchPlaceholder: '', emptyText: 'Nenhuma importação registrada ainda.',
    fields: [
      { key: 'startedAt', label: 'Início', type: 'datetime', readOnly: true },
      { key: 'kind', label: 'Tipo', type: 'text', readOnly: true },
      { key: 'duration', label: 'Duração', type: 'text', readOnly: true },
      { key: 'status', label: 'Resultado', type: 'text', readOnly: true },
      { key: 'processed', label: 'Lidos / selecionados', type: 'text', readOnly: true },
      { key: 'created', label: 'Novos', type: 'text', readOnly: true },
      { key: 'updated', label: 'Atualizados', type: 'text', readOnly: true },
      { key: 'rejected', label: 'Arquivados', type: 'text', readOnly: true },
      { key: 'error', label: 'Erro', type: 'text', readOnly: true },
    ],
  },
}

export const isResourceSlug = (value: string): value is ResourceSlug => value in resources

/** Recursos (feature flags) que o código do site realmente consulta. */
export const wiredFlags: Record<string, string> = {
  cupons: 'Página /cupons e o link no menu',
}
