/**
 * Configurações editáveis pelo painel, guardadas em `global_settings` (uma linha por chave, valor JSON).
 *
 * Este arquivo é isomórfico: o painel usa `fields` para desenhar o formulário e o servidor usa as mesmas
 * definições para validar. O site lê os valores com `getSetting()` (lib/settings.ts), sempre com `defaults`
 * por baixo, então uma chave nunca gravada devolve o comportamento original.
 */
import type { Permission } from '@/lib/auth/rbac'

export type SettingField =
  | { key: string; label: string; type: 'text' | 'textarea' | 'url'; help?: string; maxLength?: number; placeholder?: string; optional?: boolean }
  | { key: string; label: string; type: 'number'; help?: string; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; type: 'boolean'; help?: string }
  | { key: string; label: string; type: 'color'; help?: string }
  | { key: string; label: string; type: 'select'; help?: string; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'list'; help?: string; placeholder?: string }
  | { key: string; label: string; type: 'order'; help?: string; items: { id: string; label: string }[] }

export type SettingKey = 'seo' | 'theme' | 'home' | 'ranking' | 'slots' | 'tracking'

export type SettingDefinition = {
  key: SettingKey
  title: string
  description: string
  permission: Permission
  fields: SettingField[]
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

const numberField = (key: string, label: string, min: number, max: number, help?: string, unit?: string): SettingField => ({ key, label, type: 'number', min, max, help, unit })

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
      { key: 'ogImageUrl', label: 'Imagem de compartilhamento (URL)', type: 'url', optional: true, help: 'Usada quando o link é compartilhado em redes sociais e mensageiros.' },
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
  if (key === 'ranking' && rankingFactors.every(([factor]) => Number(value[factor]) === 0)) errors.relevance = 'Pelo menos um fator precisa ter peso maior que zero.'

  return Object.keys(errors).length ? { errors } : { value }
}
