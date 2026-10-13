import type { ResourceSlug } from '@/lib/admin/resource-meta'
import type { SettingKey } from '@/lib/admin/settings-defs'

/**
 * Registro dos módulos do painel. Todos têm banco por trás; nenhum guarda dado no navegador.
 * A tela de cada um é escolhida por `view`; a permissão por módulo está em `permissionForModule` (lib/auth/rbac.ts).
 */
export type ModuleView =
  | { kind: 'resource'; resource: ResourceSlug }
  | { kind: 'settings'; key: SettingKey }
  | { kind: 'analytics'; mode: 'analytics' | 'funil' }
  | { kind: 'events' }
  | { kind: 'integrations' }
  | { kind: 'imports' }
  | { kind: 'logs' }
  | { kind: 'coupons' }
  | { kind: 'users' }
  | { kind: 'security' }

export type ModuleGroup = 'Catálogo' | 'Experiência' | 'Conteúdo' | 'Insights' | 'Governança' | 'Sistema'
export type ModuleConfig = { slug: string; title: string; description: string; group: ModuleGroup; view: ModuleView }

export const adminConfigs: ModuleConfig[] = [
  { slug: 'produtos', title: 'Produtos', description: 'Edite, oculte e classifique os produtos que vieram da Shopee.', group: 'Catálogo', view: { kind: 'resource', resource: 'produtos' } },
  { slug: 'ofertas', title: 'Ofertas', description: 'Preço e link de cada loja para cada produto.', group: 'Catálogo', view: { kind: 'resource', resource: 'ofertas' } },
  { slug: 'imports-jobs', title: 'Importações', description: 'Atualize o catálogo agora e acompanhe o histórico de cada execução.', group: 'Catálogo', view: { kind: 'imports' } },
  { slug: 'providers', title: 'Provedores', description: 'Fontes de produtos e links de afiliado.', group: 'Catálogo', view: { kind: 'resource', resource: 'providers' } },
  { slug: 'categorias', title: 'Categorias', description: 'Taxonomia da vitrine, menu e guias de compra.', group: 'Catálogo', view: { kind: 'resource', resource: 'categorias' } },
  { slug: 'marcas', title: 'Lojas e marcas', description: 'Lojas vendedoras cadastradas no catálogo.', group: 'Catálogo', view: { kind: 'resource', resource: 'marcas' } },
  { slug: 'tags', title: 'Selos', description: 'Selos exibidos nos cartões de produto.', group: 'Catálogo', view: { kind: 'resource', resource: 'tags' } },
  { slug: 'colecoes', title: 'Coleções manuais', description: 'Seleções montadas por você, na ordem que escolher.', group: 'Catálogo', view: { kind: 'resource', resource: 'colecoes' } },

  { slug: 'home-builder', title: 'Home', description: 'Textos do topo e ordem das seções da página inicial.', group: 'Experiência', view: { kind: 'settings', key: 'home' } },
  { slug: 'campanhas', title: 'Campanhas', description: 'Faixa de destaque na home, com início e fim.', group: 'Experiência', view: { kind: 'resource', resource: 'campanhas' } },
  { slug: 'ranking', title: 'Ranking', description: 'Quanto cada fator pesa na ordem das recomendações.', group: 'Experiência', view: { kind: 'settings', key: 'ranking' } },
  { slug: 'regras-catalogo', title: 'Regras do catálogo', description: 'Os limiares de “Viralizou”, “Mais vendidos”, “Achadinhos”, “Em promoção” e dos filtros da busca.', group: 'Experiência', view: { kind: 'settings', key: 'rules' } },
  { slug: 'recommendation-slots', title: 'Slots de recomendação', description: 'Onde as recomendações aparecem e quantas mostram.', group: 'Experiência', view: { kind: 'settings', key: 'slots' } },
  { slug: 'segmentos', title: 'Segmentos', description: 'Audiências salvas sobre os cliques de compra medidos.', group: 'Experiência', view: { kind: 'resource', resource: 'segmentos' } },
  { slug: 'experimentos', title: 'Recursos e experimentos', description: 'Liga, desliga e libera por porcentagem partes do site.', group: 'Experiência', view: { kind: 'resource', resource: 'flags' } },

  { slug: 'cupons', title: 'Cupons', description: 'Cupons e campanhas que ajudam a pessoa a economizar na Shopee.', group: 'Conteúdo', view: { kind: 'coupons' } },
  { slug: 'cms', title: 'Artigos', description: 'Conteúdo editorial publicado em /artigos.', group: 'Conteúdo', view: { kind: 'resource', resource: 'cms' } },
  { slug: 'paginas', title: 'Páginas', description: 'Páginas institucionais publicadas em /p.', group: 'Conteúdo', view: { kind: 'resource', resource: 'paginas' } },
  { slug: 'guias-compra', title: 'Guias de compra', description: 'O texto de “O que observar antes de comprar” de cada categoria.', group: 'Conteúdo', view: { kind: 'settings', key: 'guides' } },
  { slug: 'seo', title: 'SEO', description: 'Título, descrição e indexação do site.', group: 'Conteúdo', view: { kind: 'settings', key: 'seo' } },

  { slug: 'analytics', title: 'Analytics', description: 'Cliques e conversões de afiliado registrados na plataforma.', group: 'Insights', view: { kind: 'analytics', mode: 'analytics' } },
  { slug: 'funil', title: 'Funil', description: 'Onde as pessoas avançam ou abandonam.', group: 'Insights', view: { kind: 'analytics', mode: 'funil' } },
  { slug: 'eventos', title: 'Eventos', description: 'O que o site mediu: volumes, nomes e retenção.', group: 'Insights', view: { kind: 'events' } },

  { slug: 'usuarios-rbac', title: 'Usuários e papéis', description: 'Quem tem acesso e o que cada papel pode fazer.', group: 'Governança', view: { kind: 'users' } },
  { slug: 'lgpd', title: 'LGPD', description: 'Pedidos de titulares de dados.', group: 'Governança', view: { kind: 'resource', resource: 'lgpd' } },
  { slug: 'audit-log', title: 'Auditoria', description: 'Quem alterou o quê, e quando.', group: 'Governança', view: { kind: 'resource', resource: 'audit-log' } },
  { slug: 'logs', title: 'Logs', description: 'Falhas de importação e de tarefas em segundo plano.', group: 'Governança', view: { kind: 'logs' } },

  { slug: 'integracoes', title: 'Integrações', description: 'Serviços conectados e teste de conexão.', group: 'Sistema', view: { kind: 'integrations' } },
  { slug: 'tracking', title: 'Medição', description: 'Quais eventos são gravados e por quanto tempo.', group: 'Sistema', view: { kind: 'settings', key: 'tracking' } },
  { slug: 'tema', title: 'Tema', description: 'Cor de ação, cantos e faixa de aviso do topo.', group: 'Sistema', view: { kind: 'settings', key: 'theme' } },
  { slug: 'seguranca', title: 'Segurança', description: 'Sessões ativas e matriz de permissões.', group: 'Sistema', view: { kind: 'security' } },
]

export const getAdminConfig = (slug: string) => adminConfigs.find((item) => item.slug === slug)
