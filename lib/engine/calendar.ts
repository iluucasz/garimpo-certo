/**
 * Calendário comercial brasileiro: datas em que o comportamento de compra muda e termos de busca que valem
 * importar com antecedência. É a fonte mais barata e previsível do radar de tendências: não depende de nenhuma
 * API externa e nunca "inventa" demanda. Todas as datas são calculadas (Páscoa, Dia das Mães, Black Friday...).
 *
 * Os termos usam só as categorias que o catálogo já tem (`categoryGroups` do importador).
 */

export type SeasonTerm = { category: string; keyword: string }
export type CommercialEvent = {
  id: string
  name: string
  /** AAAA-MM-DD (data local do Brasil). */
  date: string
  /** Quantos dias antes vale começar a trazer produtos. */
  leadDays: number
  terms: SeasonTerm[]
}

const pad = (value: number) => String(value).padStart(2, '0')
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

/** Enésimo dia da semana (0 = domingo) de um mês (1–12). */
export function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  return iso(year, month, day)
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(year, month, day)
}

export function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** Dias inteiros de `from` até `to` (negativo se já passou). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Black Friday: a sexta-feira depois da quarta quinta-feira de novembro. */
export const blackFriday = (year: number) => addDays(nthWeekday(year, 11, 4, 4), 1)

const t = (category: string, ...keywords: string[]): SeasonTerm[] => keywords.map((keyword) => ({ category, keyword }))

export function eventsFor(year: number): CommercialEvent[] {
  const easter = easterSunday(year)
  return [
    { id: 'volta-as-aulas', name: 'Volta às aulas', date: iso(year, 2, 1), leadDays: 45, terms: [...t('tecnologia', 'mochila notebook', 'fone de ouvido com fio', 'pen drive 64gb'), ...t('casa', 'organizador de mesa', 'luminaria de mesa')] },
    { id: 'carnaval', name: 'Carnaval', date: addDays(easter, -47), leadDays: 21, terms: [...t('beleza', 'glitter maquiagem', 'protetor solar facial'), ...t('tecnologia', 'caixa de som bluetooth resistente a agua', 'power bank')] },
    { id: 'dia-do-consumidor', name: 'Dia do Consumidor', date: iso(year, 3, 15), leadDays: 14, terms: [...t('eletrodomesticos', 'cafeteira', 'ventilador de mesa'), ...t('eletronicos', 'smart tv 43 polegadas', 'notebook')] },
    { id: 'pascoa', name: 'Páscoa', date: easter, leadDays: 25, terms: [...t('cozinha', 'forma de ovo de pascoa', 'kit confeitaria', 'avental de cozinha'), ...t('casa', 'cesta decorativa')] },
    { id: 'dia-das-maes', name: 'Dia das Mães', date: nthWeekday(year, 5, 0, 2), leadDays: 35, terms: [...t('beleza', 'kit skincare presente', 'secador de cabelo profissional', 'perfume feminino'), ...t('casa', 'jogo de cama queen', 'luminaria decorativa'), ...t('cozinha', 'air fryer', 'jogo de panelas')] },
    { id: 'dia-dos-namorados', name: 'Dia dos Namorados', date: iso(year, 6, 12), leadDays: 25, terms: [...t('beleza', 'kit presente beleza', 'perfume'), ...t('tecnologia', 'fone bluetooth', 'smartwatch'), ...t('casa', 'luminaria decorativa')] },
    { id: 'frio', name: 'Chegada do frio', date: iso(year, 6, 21), leadDays: 30, terms: [...t('casa', 'cobertor', 'aquecedor eletrico', 'edredom casal'), ...t('eletrodomesticos', 'aquecedor de ambiente')] },
    { id: 'dia-dos-pais', name: 'Dia dos Pais', date: nthWeekday(year, 8, 0, 2), leadDays: 35, terms: [...t('tecnologia', 'smartwatch', 'fone bluetooth esportivo', 'carregador portatil'), ...t('beleza', 'kit barba', 'barbeador eletrico'), ...t('fitness', 'garrafa termica academia')] },
    { id: 'dia-das-criancas', name: 'Dia das Crianças', date: iso(year, 10, 12), leadDays: 30, terms: [...t('games', 'controle sem fio', 'jogo nintendo switch'), ...t('tecnologia', 'tablet infantil', 'caixa de som infantil'), ...t('casa', 'projetor de estrelas')] },
    { id: 'onze-onze', name: '11.11 da Shopee', date: iso(year, 11, 11), leadDays: 14, terms: [...t('tecnologia', 'fone bluetooth'), ...t('casa', 'organizador multiuso'), ...t('beleza', 'kit maquiagem')] },
    { id: 'black-friday', name: 'Black Friday', date: blackFriday(year), leadDays: 28, terms: [...t('eletronicos', 'smartphone', 'smart tv 55 polegadas', 'notebook gamer'), ...t('eletrodomesticos', 'robo aspirador', 'air fryer', 'geladeira'), ...t('games', 'console', 'headset gamer'), ...t('tecnologia', 'fone bluetooth', 'smartwatch')] },
    { id: 'doze-doze', name: '12.12 da Shopee', date: iso(year, 12, 12), leadDays: 10, terms: [...t('tecnologia', 'caixa de som bluetooth'), ...t('cozinha', 'garrafa termica')] },
    { id: 'natal', name: 'Natal', date: iso(year, 12, 25), leadDays: 35, terms: [...t('casa', 'arvore de natal', 'decoracao natalina', 'pisca pisca'), ...t('cozinha', 'kit presente cozinha', 'jogo de taças'), ...t('games', 'cartao presente console')] },
    { id: 'verao', name: 'Verão', date: iso(year, 12, 21), leadDays: 35, terms: [...t('casa', 'ventilador de mesa', 'ventilador portatil'), ...t('beleza', 'protetor solar'), ...t('cozinha', 'garrafa termica', 'copo termico')] },
  ]
}

export type UpcomingEvent = CommercialEvent & { daysUntil: number; /** Último dia em que os termos ainda valem. */ until: string }

/** Eventos cuja janela de preparação (`leadDays`) está aberta hoje, e que ainda não passaram. */
export function upcomingEvents(today: string, lookaheadDays: number): UpcomingEvent[] {
  const year = Number(today.slice(0, 4))
  return [...eventsFor(year), ...eventsFor(year + 1)]
    .map((event) => ({ ...event, daysUntil: daysBetween(today, event.date), until: addDays(event.date, 2) }))
    .filter((event) => event.daysUntil >= 0 && event.daysUntil <= Math.min(event.leadDays, lookaheadDays))
    .sort((a, b) => a.daysUntil - b.daysUntil)
}
