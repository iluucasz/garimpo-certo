/**
 * Configurações editáveis pelo painel, guardadas em `global_settings` (uma linha por chave, valor JSON).
 *
 * Este arquivo é isomórfico: o painel usa `fields` para desenhar o formulário e o servidor usa as mesmas
 * definições para validar. O site lê os valores com `getSetting()` (lib/settings.ts), sempre com `defaults`
 * por baixo, então uma chave nunca gravada devolve o comportamento original.
 */
import type { Permission } from '@/lib/auth/rbac'
import { defaultCatalogRules } from '@/lib/catalog/rules'
import { guideCategoryLabels, guideChecklists, parseChecklist, serializeChecklist } from '@/lib/catalog/guides'

export type SettingField =
  | { key: string; label: string; type: 'text' | 'textarea' | 'url'; help?: string; maxLength?: number; placeholder?: string; optional?: boolean; upload?: boolean }
  | { key: string; label: string; type: 'number'; help?: string; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; type: 'boolean'; help?: string }
  | { key: string; label: string; type: 'color'; help?: string }
  | { key: string; label: string; type: 'select'; help?: string; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'list'; help?: string; placeholder?: string }
  | { key: string; label: string; type: 'order'; help?: string; items: { id: string; label: string }[] }
  | { key: string; label: string; type: 'checklist'; help?: string }

export type SettingKey = 'seo' | 'theme' | 'home' | 'ranking' | 'slots' | 'tracking' | 'rules' | 'guides' | 'engine' | 'social' | 'import' | 'content'

/** Agrupamento opcional dos campos na tela: cada seção vira um cartão com título e explicação curta. */
export type SettingSection = { title: string; description?: string; keys: string[] }

export type SettingDefinition = {
  key: SettingKey
  title: string
  description: string
  permission: Permission
  fields: SettingField[]
  /** Sem seções, todos os campos ficam num cartão só. */
  sections?: SettingSection[]
  defaults: Record<string, unknown>
}

export type SettingValue = Record<string, unknown>

export const homeSections = [
  { id: 'catalog', label: 'Vitrine de produtos (abas Em alta, Descontos…)' },
  { id: 'selections', label: 'Escolha pelo que importa' },
  { id: 'guides', label: 'Guias de compra' },
  { id: 'howItWorks', label: 'Como funciona' },
] as const

export const rankingFactors = [
  ['relevance', 'Relevância', 'Quanto o produto combina com o contexto (categoria, produto de origem).'],
  ['affinity', 'Afinidade', 'Combinação com os interesses e o histórico de quem está vendo.'],
  ['engagement', 'Engajamento', 'Visualizações, cliques e favoritos medidos no próprio site.'],
  ['quality', 'Qualidade', 'Nota e volume de vendas informados pela Shopee.'],
  ['commercial', 'Valor comercial', 'Comissão esperada da oferta.'],
  ['price', 'Preço', 'Quão competitivo é o preço frente a ofertas parecidas.'],
  ['freshness', 'Frescor', 'Preferência por ofertas sincronizadas há pouco tempo.'],
  ['similarity', 'Similaridade', 'Parecido com o produto que a pessoa está olhando.'],
] as const

/** Estilos prontos do ranking: cada um é só um conjunto de pesos (os mesmos campos do ajuste fino). */
export const rankingPresets: { id: string; title: string; description: string; values: Record<string, number> }[] = [
  { id: 'balanced', title: 'Equilibrado', description: 'Mistura qualidade, preço, interesse do visitante e novidades. É o ponto de partida.',
    values: { relevance: 18, affinity: 15, engagement: 14, quality: 16, commercial: 8, price: 12, freshness: 8, similarity: 9, exploration: 12 } },
  { id: 'quality', title: 'Os melhores avaliados', description: 'Prioriza nota alta e muitas vendas. Mostra o que já deu certo para outras pessoas.',
    values: { relevance: 14, affinity: 10, engagement: 20, quality: 30, commercial: 6, price: 8, freshness: 4, similarity: 8, exploration: 8 } },
  { id: 'price', title: 'Melhor preço', description: 'Prioriza ofertas com preço competitivo frente a produtos parecidos.',
    values: { relevance: 14, affinity: 10, engagement: 10, quality: 18, commercial: 6, price: 30, freshness: 4, similarity: 8, exploration: 10 } },
  { id: 'discovery', title: 'Novidades e descobertas', description: 'Dá espaço a ofertas recém-atualizadas e a produtos fora do padrão.',
    values: { relevance: 14, affinity: 10, engagement: 8, quality: 12, commercial: 4, price: 8, freshness: 26, similarity: 6, exploration: 25 } },
]

/** Estilos prontos das regras do catálogo (mesmos campos do ajuste fino). */
export const rulesPresets: { id: string; title: string; description: string; values: Record<string, number> }[] = [
  { id: 'strict', title: 'Mais seleto', description: 'Coleções menores e mais exigentes: só entra o que tem muita venda e nota muito alta.',
    values: { viralSales: 20000, topSales: 2000, lovedSales: 2000, lovedRating: 4.9, findsPrice: 20, findsRating: 4.8, findsSales: 1000, promoDiscount: 30, heavyDiscount: 50, premiumPrice: 500, topRating: 4.9, perfectRating: 5, valueScore: 90, valuePriceMax: 1000 } },
  { id: 'default', title: 'Padrão', description: 'O ponto de partida do Garimpo: equilibrado entre variedade e qualidade.',
    values: { viralSales: 10000, topSales: 1000, lovedSales: 1000, lovedRating: 4.8, findsPrice: 30, findsRating: 4.7, findsSales: 500, promoDiscount: 20, heavyDiscount: 40, premiumPrice: 500, topRating: 4.8, perfectRating: 4.9, valueScore: 85, valuePriceMax: 1500 } },
  { id: 'broad', title: 'Mais abrangente', description: 'Coleções maiores: entram mais produtos, com exigência menor de venda, nota e desconto.',
    values: { viralSales: 5000, topSales: 500, lovedSales: 500, lovedRating: 4.6, findsPrice: 50, findsRating: 4.5, findsSales: 250, promoDiscount: 10, heavyDiscount: 30, premiumPrice: 500, topRating: 4.6, perfectRating: 4.8, valueScore: 75, valuePriceMax: 2000 } },
]

const numberField = (key: string, label: string, min: number, max: number, help?: string, unit?: string, step?: number): SettingField => ({ key, label, type: 'number', min, max, help, unit, ...(step ? { step } : {}) })

export const settingDefinitions: Record<SettingKey, SettingDefinition> = {
  seo: {
    key: 'seo',
    title: 'SEO e indexação',
    description: 'Título, descrição e regras de indexação usados em todo o site.',
    permission: 'content:write',
    fields: [
      { key: 'siteTitle', label: 'Título padrão', type: 'text', maxLength: 70, help: 'Aparece na aba do navegador e nos resultados de busca quando a página não define o seu.' },
      { key: 'titleTemplate', label: 'Modelo do título das páginas', type: 'text', maxLength: 70, help: 'Use %s onde entra o título da página. Exemplo: %s · Garimpo' },
      { key: 'description', label: 'Descrição padrão', type: 'textarea', maxLength: 170, help: 'Até 160 caracteres rende melhor nos buscadores.' },
      { key: 'ogImageUrl', label: 'Imagem de compartilhamento (URL)', type: 'url', optional: true, upload: true, help: 'Usada quando o link é compartilhado em redes sociais e mensageiros.' },
      { key: 'googleVerification', label: 'Código de verificação do Google Search Console', type: 'text', optional: true, maxLength: 120, help: 'Só o valor do atributo content da meta tag.' },
      { key: 'indexing', label: 'Permitir indexação por buscadores', type: 'boolean', help: 'Desligado, o site inteiro pede aos buscadores para não aparecer nos resultados. Use só antes do lançamento.' },
    ],
    defaults: {
      siteTitle: 'Garimpo — Descobertas que valem a pena',
      titleTemplate: '%s · Garimpo',
      description: 'Curadoria inteligente de produtos úteis, bonitos e com preços que valem a pena.',
      ogImageUrl: '',
      googleVerification: '',
      indexing: true,
    },
  },
  theme: {
    key: 'theme',
    title: 'Tema e aviso do topo',
    description: 'Cor de ação, cantos e a faixa de aviso do alto do site.',
    permission: 'settings:write',
    fields: [
      { key: 'primary', label: 'Cor de ação (botões e destaques)', type: 'color', help: 'Precisa ter contraste mínimo de 4,5:1 com texto branco para o botão continuar legível.' },
      { key: 'radius', label: 'Cantos', type: 'select', options: [{ value: 'compact', label: 'Retos (compacto)' }, { value: 'default', label: 'Arredondados (padrão)' }, { value: 'round', label: 'Bem arredondados' }] },
      { key: 'noticeText', label: 'Faixa de aviso no topo', type: 'text', optional: true, maxLength: 140, help: 'Deixe vazio para ocultar a faixa. Mantenha a menção a links de afiliado.' },
      { key: 'noticeDetail', label: 'Complemento do aviso', type: 'text', optional: true, maxLength: 140 },
    ],
    defaults: {
      primary: '#c3441d',
      radius: 'default',
      noticeText: 'Preços e avaliações vêm da Shopee.',
      noticeDetail: 'Usamos links de afiliado.',
    },
  },
  home: {
    key: 'home',
    title: 'Home',
    description: 'Textos do topo e ordem das seções da página inicial.',
    permission: 'content:write',
    fields: [
      { key: 'heroTitle', label: 'Título (linha 1)', type: 'text', maxLength: 40 },
      { key: 'heroAccent', label: 'Título (linha 2, em destaque)', type: 'text', maxLength: 40 },
      { key: 'heroLead', label: 'Texto de apoio', type: 'textarea', maxLength: 200 },
      { key: 'ctaLabel', label: 'Texto do botão principal', type: 'text', maxLength: 24 },
      { key: 'sectionOrder', label: 'Ordem das seções', type: 'order', items: homeSections.map((section) => ({ id: section.id, label: section.label })) },
      ...homeSections.map((section): SettingField => ({ key: `show_${section.id}`, label: `Mostrar: ${section.label}`, type: 'boolean' })),
    ],
    defaults: {
      heroTitle: 'Bons produtos.',
      heroAccent: 'Preços que valem.',
      heroLead: 'Encontre seu próximo achado e compre direto na loja com a melhor oferta disponível.',
      ctaLabel: 'Ver ofertas',
      sectionOrder: homeSections.map((section) => section.id),
      ...Object.fromEntries(homeSections.map((section) => [`show_${section.id}`, true])),
    },
  },
  ranking: {
    key: 'ranking',
    title: 'Pesos do ranking',
    description: 'Quanto cada fator pesa na ordem dos produtos recomendados. Os pesos são normalizados: só a proporção importa.',
    permission: 'catalog:write',
    fields: [
      ...rankingFactors.map(([key, label, help]) => numberField(key, label, 0, 100, help)),
      numberField('exploration', 'Exploração', 0, 40, 'Parte das recomendações reservada a itens fora do padrão, para descobrir produtos novos.', '%'),
    ],
    sections: [
      { title: 'O produto em si', description: 'Sinais que vêm do cadastro e da Shopee.', keys: ['relevance', 'quality', 'commercial', 'price', 'freshness', 'similarity'] },
      { title: 'O comportamento de quem visita', description: 'Sinais medidos no próprio site, só com permissão do visitante.', keys: ['affinity', 'engagement'] },
      { title: 'Descoberta', description: 'Espaço para o que foge do padrão.', keys: ['exploration'] },
    ],
    defaults: { relevance: 18, affinity: 15, engagement: 14, quality: 16, commercial: 8, price: 12, freshness: 8, similarity: 9, exploration: 12 },
  },
  slots: {
    key: 'slots',
    title: 'Slots de recomendação',
    description: 'Onde as recomendações aparecem e quantos itens mostram.',
    permission: 'catalog:write',
    fields: [
      { key: 'similarEnabled', label: 'Mostrar “Você também pode gostar” na página do produto', type: 'boolean' },
      numberField('similarLimit', 'Quantidade de itens', 1, 8, 'Itens exibidos na faixa de produtos relacionados.'),
    ],
    sections: [{ title: 'Página do produto', description: 'A faixa de produtos relacionados abaixo do produto.', keys: ['similarEnabled', 'similarLimit'] }],
    defaults: { similarEnabled: true, similarLimit: 4 },
  },
  tracking: {
    key: 'tracking',
    title: 'Medição',
    description: 'Controle de quais eventos de uso são gravados. Eventos só saem do navegador com a permissão da pessoa.',
    permission: 'settings:write',
    fields: [
      { key: 'disabledEvents', label: 'Eventos desligados', type: 'list', placeholder: 'um nome de evento por linha', help: 'Eventos desta lista são descartados no servidor. Nomes comuns: page_view, search, product_view, favorite_add, compare_add, recommendation_impression.' },
      numberField('retentionDays', 'Guardar eventos por', 30, 730, 'Eventos mais antigos podem ser apagados pelo botão “Limpar eventos antigos” em Eventos.', 'dias'),
    ],
    defaults: { disabledEvents: [] as string[], retentionDays: 180 },
  },
  rules: {
    key: 'rules',
    title: 'Regras do catálogo',
    description: 'Os limiares que decidem o que entra em “Viralizou”, “Mais vendidos”, “Achadinhos”, “Em promoção” e nos filtros da busca. O texto de cada coleção acompanha o valor escolhido. Mudanças valem para o site inteiro em até 5 minutos.',
    permission: 'catalog:write',
    fields: [
      numberField('viralSales', 'Viralizou: vendas mínimas', 1000, 200000, 'Vendas recentes informadas pela Shopee para entrar em “Viralizou na Shopee”.', 'vendas', 500),
      numberField('topSales', 'Mais vendidos: vendas mínimas', 100, 50000, 'Vale para a coleção e para o filtro “Mais vendidos” da busca e da home.', 'vendas', 100),
      numberField('lovedSales', 'Queridinhos: vendas mínimas', 100, 50000, undefined, 'vendas', 100),
      numberField('lovedRating', 'Queridinhos: nota mínima', 4, 5, undefined, 'estrelas', 0.1),
      numberField('findsPrice', 'Achadinhos: preço máximo', 5, 200, undefined, 'R$', 5),
      numberField('findsRating', 'Achadinhos: nota mínima', 4, 5, undefined, 'estrelas', 0.1),
      numberField('findsSales', 'Achadinhos e Nota máxima: vendas mínimas', 50, 20000, 'Evita que nota 5 com poucas vendas entre.', 'vendas', 50),
      numberField('promoDiscount', 'Em promoção: desconto mínimo', 5, 90, 'Em relação ao preço anterior informado pela Shopee.', '%'),
      numberField('heavyDiscount', 'Desconto pesado: desconto mínimo', 10, 90, 'Precisa ser igual ou maior que o de “Em promoção”.', '%'),
      numberField('premiumPrice', 'Acima de R$ 500: preço mínimo', 100, 5000, 'O nome da coleção continua “Acima de R$ 500”; ajuste só se mudar o valor de propósito.', 'R$', 50),
      numberField('topRating', 'Bem avaliados: nota mínima', 4, 5, 'Vale para a coleção e para o filtro “Bem avaliados”.', 'estrelas', 0.1),
      numberField('perfectRating', 'Nota máxima: nota mínima', 4, 5, undefined, 'estrelas', 0.1),
      numberField('valueScore', 'Bom custo-benefício: Índice Garimpo mínimo', 50, 100, 'Vale para a coleção e para o filtro da busca.'),
      numberField('valuePriceMax', 'Bom custo-benefício: preço máximo', 100, 10000, undefined, 'R$', 50),
    ],
    sections: [
      { title: 'Em alta', description: 'Quantas vendas a Shopee informa para entrar.', keys: ['viralSales', 'topSales'] },
      { title: 'Queridinhos', description: 'Vendas e nota juntas.', keys: ['lovedSales', 'lovedRating'] },
      { title: 'Achadinhos', description: 'Baratos e bem avaliados.', keys: ['findsPrice', 'findsRating', 'findsSales'] },
      { title: 'Preço e desconto', description: 'Em relação ao preço anterior informado pela Shopee.', keys: ['promoDiscount', 'heavyDiscount', 'premiumPrice'] },
      { title: 'Qualidade', description: 'Nota e custo-benefício.', keys: ['topRating', 'perfectRating', 'valueScore', 'valuePriceMax'] },
    ],
    defaults: { ...defaultCatalogRules },
  },
  engine: {
    key: 'engine',
    title: 'Engine',
    description: 'Como a Engine decide o que sugerir. Em “Sombra” ela só registra o que faria, sem pedir nada; em “Com aprovação” cada sugestão espera o seu OK; em “Automático” só o que é reversível (termos sazonais) é aplicado sozinho.',
    permission: 'catalog:write',
    fields: [
      { key: 'mode', label: 'Modo', type: 'select', options: [
        { value: 'off', label: 'Desligada' },
        { value: 'shadow', label: 'Sombra (só registra)' },
        { value: 'approval', label: 'Com aprovação' },
        { value: 'auto', label: 'Automático (só o reversível)' },
      ] },
      numberField('windowDays', 'Janela de análise', 14, 90, 'Quantos dias de visitas, cliques e favoritos a Engine considera.', 'dias'),
      numberField('minSiteViews', 'Visitas mínimas para decidir', 50, 5000, 'Abaixo disso a faxina não sugere nada: pouca gente visitando não prova que o produto é ruim.', 'visitas'),
      numberField('minAgeDays', 'Idade mínima do produto', 7, 180, 'Produto que entrou há menos tempo que isso nunca é sugerido para sair.', 'dias'),
      numberField('maxPerRun', 'Máximo de sugestões por execução', 1, 50, undefined, 'produtos'),
      numberField('maxSharePercent', 'Parte máxima do catálogo por execução', 1, 30, undefined, '%'),
      { key: 'seasonalEnabled', label: 'Sugerir termos de datas comerciais (Dia das Mães, Black Friday…)', type: 'boolean' },
      numberField('lookaheadDays', 'Antecedência máxima do calendário', 7, 90, undefined, 'dias'),
      { key: 'learnEnabled', label: 'Aprender com os cliques (importar mais do que rende e priorizar nas postagens)', type: 'boolean', help: 'Só age com cliques suficientes no site. Antes disso, não muda nada.' },
      numberField('minSiteClicks', 'Cliques mínimos para aprender', 20, 2000, 'Abaixo disso a Engine não compara categorias: poucos cliques não provam nada.', 'cliques'),
      numberField('quotaExtra', 'Produtos a mais por categoria que rende', 5, 40, 'Soma-se à quantidade normal por categoria, por 30 dias, depois que você aprova.', 'produtos'),
    ],
    sections: [
      { title: 'Modo', description: 'Quanto a Engine pode fazer sozinha.', keys: ['mode'] },
      { title: 'Faxina do catálogo', description: 'Quando sugerir tirar um produto da vitrine.', keys: ['windowDays', 'minSiteViews', 'minAgeDays', 'maxPerRun', 'maxSharePercent'] },
      { title: 'Datas comerciais', description: 'Termos de busca para as datas que se aproximam.', keys: ['seasonalEnabled', 'lookaheadDays'] },
      { title: 'Aprender com os cliques', description: 'Mais produtos nas categorias que rendem e prioridade a elas nas postagens.', keys: ['learnEnabled', 'minSiteClicks', 'quotaExtra'] },
    ],
    defaults: { mode: 'shadow', windowDays: 30, minSiteViews: 500, minAgeDays: 30, maxPerRun: 10, maxSharePercent: 10, seasonalEnabled: true, lookaheadDays: 40, learnEnabled: true, minSiteClicks: 50, quotaExtra: 10 },
  },
  import: {
    key: 'import',
    title: 'Importação de produtos',
    description: 'Como a importação diária da Shopee escolhe e quantos produtos traz. As faixas de preço e as categorias continuam as do sistema; aqui ficam os números que mais mudam o resultado.',
    permission: 'catalog:write',
    fields: [
      { key: 'enabled', label: 'Importação diária ligada', type: 'boolean', help: 'Desligada, o worker não importa às 6h. Dá para importar à mão em Importações.' },
      numberField('perCategory', 'Produtos por categoria', 10, 80, 'Com 11 categorias, 40 dá cerca de 440 produtos. Quanto maior, mais tempo a importação leva.', 'produtos'),
      numberField('minRating', 'Nota mínima', 4, 5, 'Só entra produto com nota igual ou maior.', 'estrelas', 0.1),
      numberField('minSales', 'Vendas mínimas (faixa até R$ 99)', 10, 500, 'As faixas mais caras usam proporções menores: itens caros vendem menos.', 'vendas'),
      numberField('maxPerShop', 'Máximo por loja, em cada categoria', 1, 5, 'Evita uma vitrine dominada por um vendedor só.', 'produtos'),
    ],
    sections: [
      { title: 'Rotina', description: 'Liga ou desliga a importação das 6h.', keys: ['enabled'] },
      { title: 'Quanto e com que qualidade', description: 'O que decide quantos produtos entram e quais passam do corte.', keys: ['perCategory', 'minRating', 'minSales', 'maxPerShop'] },
    ],
    defaults: { enabled: true, perCategory: 40, minRating: 4.5, minSales: 50, maxPerShop: 2 },
  },
  social: {
    key: 'social',
    title: 'Postagens no Telegram',
    description: 'Quantas ofertas vão ao canal por dia e em que horário. O texto usa só números reais da oferta. Com “exigir aprovação”, nada é publicado sem o seu OK. Comece com 3 a 5 boas ofertas por dia e meça quais geram clique.',
    permission: 'catalog:write',
    fields: [
      { key: 'mode', label: 'Postagens', type: 'select', options: [{ value: 'off', label: 'Desligadas' }, { value: 'on', label: 'Ligadas' }] },
      numberField('dailyLimit', 'Ofertas por dia', 1, 30, 'Espalhadas entre a primeira e a última postagem. Com muitas por dia, a Engine reduz sozinha o intervalo para repetir um produto, para a lista não acabar.', 'por dia'),
      numberField('startHour', 'Primeira postagem a partir de', 6, 20, 'Horário de Brasília.', 'h'),
      numberField('endHour', 'Última postagem até', 10, 23, 'Horário de Brasília.', 'h'),
      { key: 'requireApproval', label: 'Exigir a minha aprovação antes de publicar', type: 'boolean', help: 'Recomendado. Desligado, o que a Engine escolher é publicado no horário.' },
      { key: 'autoPlan', label: 'A Engine sugere as ofertas do dia sozinha', type: 'boolean', help: 'Cria as postagens de hoje a partir das melhores ofertas ainda não divulgadas. Você pode criar à mão também.' },
      { key: 'useAi', label: 'Usar IA para variar o texto das postagens novas', type: 'boolean', help: 'A IA só muda o tom e a estrutura. Preço, nota, vendas e link vêm dos dados; qualquer texto que invente número, desconto ou urgência é descartado e vale o modelo fixo.' },
      { key: 'campaign', label: 'Nome da campanha (etiqueta do link)', type: 'text', maxLength: 24, help: 'Só letras e números. Aparece em Analytics como telegram › campanha, para separar o que rende.' },
    ],
    defaults: { mode: 'off', dailyLimit: 15, startHour: 9, endHour: 21, requireApproval: true, autoPlan: true, useAi: false, campaign: 'ofertas' },
  },
  content: {
    key: 'content',
    title: 'Conteúdo para Instagram e TikTok',
    description: 'Quantos posts por dia a Engine prepara para cada rede. Cada um vem com legenda, roteiro, hashtags, imagem e o link de afiliado com etiqueta do canal; você publica na rede e marca como publicado. O texto usa só números reais da oferta.',
    permission: 'catalog:write',
    fields: [
      numberField('instagramDaily', 'Posts de Instagram por dia', 0, 5, '0 desliga o canal.', 'por dia'),
      numberField('tiktokDaily', 'Vídeos de TikTok por dia', 0, 5, '0 desliga o canal.', 'por dia'),
      numberField('startHour', 'Horário sugerido a partir de', 6, 20, 'Horário de Brasília. É só uma sugestão: nada é publicado sozinho.', 'h'),
      numberField('endHour', 'Horário sugerido até', 10, 23, 'Horário de Brasília.', 'h'),
      { key: 'autoPlan', label: 'A Engine prepara os posts do dia sozinha', type: 'boolean', help: 'Cria os posts de hoje a partir das melhores ofertas ainda não divulgadas na rede. Você também pode criar à mão.' },
      { key: 'disclosure', label: 'Identificar como publicidade (#publi e aviso de afiliado)', type: 'boolean', help: 'Recomendado: o Instagram e o TikTok exigem identificar conteúdo com link de afiliado, e a publicidade no Brasil também.' },
      { key: 'hashtags', label: 'Hashtags fixas da marca', type: 'text', maxLength: 120, help: 'Separadas por espaço. As da categoria do produto são somadas sozinhas.' },
      { key: 'campaign', label: 'Nome da campanha (etiqueta do link)', type: 'text', maxLength: 24, help: 'Só letras e números. Aparece em Analytics como instagram › campanha ou tiktok › campanha.' },
    ],
    sections: [
      { title: 'Quanto por dia', description: 'Zero desliga a rede.', keys: ['instagramDaily', 'tiktokDaily', 'autoPlan'] },
      { title: 'Horário sugerido', keys: ['startHour', 'endHour'] },
      { title: 'Texto e etiquetas', keys: ['disclosure', 'hashtags', 'campaign'] },
    ],
    defaults: { instagramDaily: 1, tiktokDaily: 1, startHour: 10, endHour: 20, autoPlan: true, disclosure: true, hashtags: '#garimpou #achadinhos', campaign: 'redes' },
  },
  guides: {
    key: 'guides',
    title: 'Guias de compra',
    description: 'O bloco “O que observar antes de comprar” de cada guia. Escreva uma verificação por linha, no formato Título | Texto, com até 6 por categoria. Deixe a categoria em branco para usar o texto original. É orientação geral de compra: não prometa preço, desconto nem resultado.',
    permission: 'content:write',
    fields: Object.keys(guideChecklists).map((slug): SettingField => ({
      key: slug,
      label: `${guideCategoryLabels[slug] ?? slug}`,
      type: 'checklist',
      help: 'Uma verificação por linha: Título | Texto',
    })),
    defaults: Object.fromEntries(Object.entries(guideChecklists).map(([slug, checks]) => [slug, serializeChecklist(checks)])),
  },
}

export const settingKeys = Object.keys(settingDefinitions) as SettingKey[]
export const isSettingKey = (value: string): value is SettingKey => value in settingDefinitions

const hexPattern = /^#[0-9a-fA-F]{6}$/

export function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
export const contrastWithWhite = (hex: string) => 1.05 / (relativeLuminance(hex) + 0.05)

/** Valida e normaliza um valor recebido. Campos desconhecidos são descartados; ausentes usam o padrão. */
export function normalizeSetting(key: SettingKey, input: unknown): { value: SettingValue } | { errors: Record<string, string> } {
  const definition = settingDefinitions[key]
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const value: SettingValue = {}
  const errors: Record<string, string> = {}

  for (const field of definition.fields) {
    const raw = source[field.key] ?? definition.defaults[field.key]
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'url': {
        const text = typeof raw === 'string' ? raw.trim() : ''
        if (!text && !field.optional) { errors[field.key] = 'Campo obrigatório.'; break }
        if (field.maxLength && text.length > field.maxLength) { errors[field.key] = `No máximo ${field.maxLength} caracteres.`; break }
        if (field.type === 'url' && text && !/^https?:\/\/[^\s]+$/i.test(text)) { errors[field.key] = 'Use um endereço completo começando com http:// ou https://.'; break }
        value[field.key] = text
        break
      }
      case 'number': {
        const number = Number(raw)
        if (!Number.isFinite(number) || number < field.min || number > field.max) { errors[field.key] = `Informe um valor entre ${field.min} e ${field.max}.`; break }
        value[field.key] = field.step && field.step < 1 ? number : Math.round(number)
        break
      }
      case 'boolean':
        value[field.key] = raw === true || raw === 'true'
        break
      case 'color': {
        const color = typeof raw === 'string' ? raw.trim() : ''
        if (!hexPattern.test(color)) { errors[field.key] = 'Use uma cor no formato #RRGGBB.'; break }
        value[field.key] = color.toLowerCase()
        break
      }
      case 'select': {
        const option = field.options.find((item) => item.value === raw)
        if (!option) { errors[field.key] = 'Opção inválida.'; break }
        value[field.key] = option.value
        break
      }
      case 'list': {
        const items = (Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n/) : [])
          .map((item) => String(item).trim()).filter(Boolean)
        if (items.some((item) => !/^[a-z0-9_.:-]{1,64}$/i.test(item))) { errors[field.key] = 'Use só letras, números, ponto, hífen, dois-pontos e sublinhado.'; break }
        value[field.key] = [...new Set(items)].slice(0, 100)
        break
      }
      case 'checklist': {
        const text = typeof raw === 'string' ? raw.trim() : ''
        if (!text) { value[field.key] = ''; break }
        const parsed = parseChecklist(text)
        if (parsed.error) { errors[field.key] = parsed.error; break }
        value[field.key] = serializeChecklist(parsed.checks)
        break
      }
      case 'order': {
        const valid = field.items.map((item) => item.id)
        const given = (Array.isArray(raw) ? raw : []).map(String).filter((id) => valid.includes(id))
        value[field.key] = [...new Set([...given, ...valid])]
        break
      }
    }
  }

  if (key === 'seo' && typeof value.titleTemplate === 'string' && !value.titleTemplate.includes('%s')) errors.titleTemplate = 'O modelo precisa conter %s.'
  if (key === 'theme' && typeof value.primary === 'string' && hexPattern.test(value.primary) && contrastWithWhite(value.primary) < 4.5) {
    errors.primary = `Contraste de ${contrastWithWhite(value.primary).toFixed(1)}:1 com branco é baixo demais (mínimo 4,5:1). Escolha uma cor mais escura.`
  }
  if (key === 'rules' && Number(value.heavyDiscount) < Number(value.promoDiscount)) errors.heavyDiscount = '“Desconto pesado” não pode ser menor que “Em promoção”.'
  if (key === 'ranking' && rankingFactors.every(([factor]) => Number(value[factor]) === 0)) errors.relevance = 'Pelo menos um fator precisa ter peso maior que zero.'

  return Object.keys(errors).length ? { errors } : { value }
}
