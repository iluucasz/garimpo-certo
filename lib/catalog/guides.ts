import type { Category, Offer, Product } from '@/lib/types'
import { currentPrice, offerDiscount } from './signals'

export type GuideCheck = { title: string; text: string }

/**
 * O que observar antes de comprar, por categoria. É orientação geral de compra (não dado do catálogo),
 * mantida curta e sem promessas. Edite aqui; o resto da página vem do banco.
 */
export const guideChecklists: Record<string, GuideCheck[]> = {
  games: [
    { title: 'Edição e versão', text: 'Console com ou sem leitor de disco, 825 GB ou outra capacidade: confira a edição exata no título e nas fotos antes de comparar preços.' },
    { title: 'O que vem na caixa', text: 'Veja se acompanha controle, cabos e jogo. Anúncios parecidos podem incluir itens diferentes.' },
    { title: 'Garantia e nota fiscal', text: 'Em produto de valor alto, confirme se a loja informa garantia e emite nota fiscal, e se o vendedor é loja oficial ou revendedor.' },
    { title: 'Compatibilidade de acessórios', text: 'Controles, headsets e cabos variam por plataforma e geração. Confira o modelo do seu console.' },
  ],
  eletronicos: [
    { title: 'Ficha técnica completa', text: 'Em celulares, notebooks e TVs, compare memória, armazenamento e tamanho de tela em vez de só o nome do modelo.' },
    { title: 'Novo, usado ou recondicionado', text: 'Alguns anúncios são de aparelho usado. O estado costuma estar no título ou na descrição da loja.' },
    { title: 'Garantia e assistência', text: 'Veja o prazo de garantia e se há assistência no Brasil. Em importados, o suporte pode ser limitado.' },
    { title: 'Preço varia com a variação', text: 'Cores, capacidades e voltagens têm preços diferentes. Escolha a variação antes de comparar.' },
  ],
  eletrodomesticos: [
    { title: 'Voltagem', text: 'Confirme 110 V, 220 V ou bivolt. Aparelho com voltagem errada queima ou não liga.' },
    { title: 'Tamanho e instalação', text: 'Meça o espaço e a porta de entrada. Geladeiras, máquinas e fogões raramente passam se a medida estiver no limite.' },
    { title: 'Consumo de energia', text: 'Veja a etiqueta de eficiência: o custo na conta de luz ao longo dos anos pesa mais que pequenas diferenças de preço.' },
    { title: 'Entrega e montagem', text: 'Itens grandes têm prazo e regras próprias de entrega. Confira o que a loja informa antes de finalizar.' },
  ],
  tecnologia: [
    { title: 'Compatibilidade antes de tudo', text: 'Confira se o produto funciona com o seu aparelho (versão do Bluetooth, tipo de entrada USB, sistema do celular) e se o anúncio informa isso.' },
    { title: 'Bateria e carregamento', text: 'Veja a autonomia declarada e o tipo de carregador. Números muito acima do usual costumam vir de testes em condições ideais.' },
    { title: 'Nota e vendas, juntas', text: 'Nota alta com poucas vendas diz menos do que uma nota boa com milhares de vendas. Olhe as duas.' },
    { title: 'Troca e devolução', text: 'Leia as condições de devolução e a proteção ao comprador exibidas na loja antes de finalizar.' },
  ],
  casa: [
    { title: 'Medidas reais', text: 'Compare as medidas do anúncio com o espaço onde o item vai ficar. Tamanho errado é um dos motivos mais comuns de devolução.' },
    { title: 'Material e uso', text: 'Verifique o material descrito e se ele é indicado para o seu uso: lavagem, peso suportado, umidade.' },
    { title: 'Preço muda com a variação', text: 'Em itens com tamanhos e cores, o valor depende da variação. Escolha a variação antes de comparar preços.' },
    { title: 'Voltagem', text: 'Em itens elétricos, confira se é 110 V, 220 V ou bivolt, e a potência indicada.' },
  ],
  audio: [
    { title: 'Para que você vai usar', text: 'Música, chamadas e treino pedem coisas diferentes: microfone, resistência a suor, conforto por horas.' },
    { title: 'Conexão', text: 'Veja a versão do Bluetooth e se há cabo ou modo com fio para quando a bateria acabar.' },
    { title: 'Autonomia', text: 'Compare as horas de uso com e sem estojo ou carga extra; o número do anúncio é de uma situação específica.' },
    { title: 'Conforto', text: 'Para uso longo, peso e almofadas pesam mais que a ficha técnica.' },
  ],
  cozinha: [
    { title: 'Capacidade', text: 'Escolha pelo número de pessoas que você costuma servir. Capacidade demais ocupa espaço e gasta mais energia.' },
    { title: 'Potência e voltagem', text: 'Confira a potência e se a voltagem é a da sua tomada.' },
    { title: 'Limpeza', text: 'Peças removíveis e revestimento fácil de lavar fazem diferença no uso diário.' },
    { title: 'Materiais', text: 'Procure a indicação de materiais próprios para contato com alimentos.' },
  ],
  pet: [
    { title: 'Porte e medidas', text: 'Confira o porte indicado (pequeno, médio, grande) e as medidas. Item pequeno demais não serve; grande demais incomoda.' },
    { title: 'Material seguro', text: 'Prefira materiais resistentes e sem partes pequenas que possam ser engolidas. Em brinquedos, observe a resistência à mordida.' },
    { title: 'Higiene', text: 'Capas removíveis, laváveis e superfícies fáceis de limpar facilitam a rotina.' },
    { title: 'Adaptação', text: 'Apresente itens novos aos poucos e observe como o animal reage antes de substituir o que ele já usa.' },
  ],
  beleza: [
    { title: 'Tom e tipo de pele', text: 'Confira se há variações de tom e para qual tipo de pele ou cabelo o produto é indicado.' },
    { title: 'Validade e identificação', text: 'Veja o prazo de validade e se o anúncio informa registro ou notificação, quando exigido para esse tipo de produto.' },
    { title: 'Aparelhos', text: 'Em secadores e chapinhas, confira potência, voltagem e se há proteção térmica.' },
    { title: 'Teste antes de usar', text: 'Em maquiagem e cosméticos, teste em uma área pequena antes do uso completo.' },
  ],
  fitness: [
    { title: 'Para qual treino', text: 'Defina o uso (musculação, corrida, yoga) antes de comprar; os acessórios mudam de um para outro.' },
    { title: 'Resistência e carga', text: 'Elásticos e pesos informam a resistência ou a carga. Escolha pelo seu nível e evolua aos poucos.' },
    { title: 'Material e aderência', text: 'Em tapetes, luvas e faixas, veja material, espessura e se a superfície é antiderrapante.' },
    { title: 'Garrafas e squeezes', text: 'Confira a capacidade, a vedação da tampa e se o anúncio informa que o material é livre de BPA.' },
  ],
  'bem-estar': [
    { title: 'Ingredientes e finalidade', text: 'Leia a lista de ingredientes e para que tipo de pele ou uso o produto é indicado.' },
    { title: 'Validade e identificação', text: 'Confira o prazo de validade e se o anúncio informa registro ou notificação, quando exigido para esse tipo de produto.' },
    { title: 'Compare pelo volume', text: 'Calcule o preço por mililitro ou por unidade; a embalagem maior nem sempre sai mais barata.' },
    { title: 'Teste antes de usar', text: 'Em pele sensível, teste em uma área pequena antes do uso completo.' },
  ],
}

export type GuidePick = { label: string; reason: string; product: Product }

export type Guide = {
  slug: string
  title: string
  category: Category
  count: number
  stats: { minPrice: number; maxPrice: number; medianPrice: number; averageRating: number | null; topSeller: { product: Product; sold: number } | null }
  checks: GuideCheck[]
  picks: GuidePick[]
}

type Input = { products: Product[]; offers: Offer[]; categories: Category[]; checklists?: Record<string, GuideCheck[]> }

/** Nome de cada categoria no editor do painel (o site usa o nome que vem do banco). */
export const guideCategoryLabels: Record<string, string> = {
  games: 'Games', eletronicos: 'Eletrônicos', eletrodomesticos: 'Eletrodomésticos', tecnologia: 'Tecnologia', casa: 'Casa',
  audio: 'Áudio', cozinha: 'Cozinha', pet: 'Pet', beleza: 'Beleza', fitness: 'Fitness', 'bem-estar': 'Bem-estar',
  'moda-feminina': 'Moda feminina', 'moda-masculina': 'Moda masculina', calcados: 'Calçados', acessorios: 'Acessórios',
  infantil: 'Infantil e bebê', papelaria: 'Papelaria e escritório', automotivo: 'Automotivo', ferramentas: 'Ferramentas',
  jardim: 'Jardim e quintal', suplementos: 'Suplementos', viagem: 'Viagem e mochilas', esporte: 'Esporte e lazer',
  'cama-mesa-banho': 'Cama, mesa e banho', hobbies: 'Hobbies',
}

export const MAX_CHECKS = 6
export const MAX_CHECK_TITLE = 60
export const MAX_CHECK_TEXT = 280

/** Uma verificação por linha, no formato `Título | Texto`. É o formato do editor do painel. */
export const serializeChecklist = (checks: GuideCheck[]) => checks.map((check) => `${check.title} | ${check.text}`).join('\n')

export function parseChecklist(text: string): { checks: GuideCheck[]; error?: string } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const checks: GuideCheck[] = []
  for (const [index, line] of lines.entries()) {
    const separator = line.indexOf('|')
    const title = separator < 0 ? '' : line.slice(0, separator).trim()
    const body = separator < 0 ? '' : line.slice(separator + 1).trim()
    if (!title || !body) return { checks: [], error: `Linha ${index + 1}: use o formato "Título | Texto".` }
    if (title.length > MAX_CHECK_TITLE) return { checks: [], error: `Linha ${index + 1}: o título passa de ${MAX_CHECK_TITLE} caracteres.` }
    if (body.length > MAX_CHECK_TEXT) return { checks: [], error: `Linha ${index + 1}: o texto passa de ${MAX_CHECK_TEXT} caracteres.` }
    checks.push({ title, text: body })
  }
  if (checks.length > MAX_CHECKS) return { checks: [], error: `No máximo ${MAX_CHECKS} verificações por categoria.` }
  return { checks }
}

/** Lê a configuração `guides` do painel. Categoria em branco ou inválida mantém o texto original do código. */
export function resolveChecklists(value?: Record<string, unknown> | null): Record<string, GuideCheck[]> {
  const result: Record<string, GuideCheck[]> = {}
  if (!value || typeof value !== 'object') return result
  for (const [slug, raw] of Object.entries(value)) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const parsed = parseChecklist(raw)
    if (!parsed.error && parsed.checks.length) result[slug] = parsed.checks
  }
  return result
}

const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildGuide(input: Input, slug: string): Guide | null {
  const category = input.categories.find((item) => item.slug === slug)
  if (!category) return null
  const products = input.products.filter((product) => product.category === slug)
  if (products.length < 3) return null

  const facts = products.map((product) => {
    const offers = input.offers.filter((offer) => offer.productId === product.id)
    const best = [...offers].sort((a, b) => a.price - b.price)[0]
    return { product, price: currentPrice(product, input.offers), sold: Math.max(0, ...offers.map((offer) => offer.soldCount ?? 0)), discount: offerDiscount(best) }
  })
  const prices = facts.map((fact) => fact.price).filter((price) => price > 0)
  const rated = products.filter((product) => product.rating > 0)

  type Fact = (typeof facts)[number]
  // Cada rótulo aponta para o melhor produto de verdade naquele critério. Se o mesmo produto vence mais
  // de um critério, ele aparece uma vez só, com os rótulos juntos: nunca damos um rótulo a quem não o merece.
  const criteria: { label: string; reason: (fact: Fact) => string; order: (a: Fact, b: Fact) => number; eligible: (fact: Fact) => boolean }[] = [
    { label: 'Mais vendido', reason: (fact) => `${fact.sold.toLocaleString('pt-BR')} vendas recentes informadas pela Shopee`, order: (a, b) => b.sold - a.sold, eligible: (fact) => fact.sold > 0 },
    { label: 'Melhor avaliado', reason: (fact) => `Nota ${fact.product.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} de 5`, order: (a, b) => b.product.rating - a.product.rating || b.sold - a.sold, eligible: (fact) => fact.product.rating > 0 },
    { label: 'Maior desconto', reason: (fact) => `${Math.round(fact.discount * 100)}% abaixo do preço anterior`, order: (a, b) => b.discount - a.discount, eligible: (fact) => fact.discount >= 0.1 },
    { label: 'Mais em conta', reason: () => 'Menor preço atual da categoria', order: (a, b) => a.price - b.price, eligible: (fact) => fact.price > 0 },
  ]
  const grouped = new Map<string, GuidePick>()
  for (const criterion of criteria) {
    const winner = facts.filter(criterion.eligible).sort(criterion.order)[0]
    if (!winner) continue
    const existing = grouped.get(winner.product.id)
    if (existing) {
      existing.label = `${existing.label} · ${criterion.label}`
      existing.reason = `${existing.reason}; ${criterion.reason(winner).replace(/^./, (char) => char.toLocaleLowerCase('pt-BR'))}`
    } else {
      grouped.set(winner.product.id, { label: criterion.label, reason: criterion.reason(winner), product: winner.product })
    }
  }
  const picks = [...grouped.values()]

  const top = [...facts].sort((a, b) => b.sold - a.sold)[0]
  return {
    slug,
    title: `Guia de compra: ${category.name}`,
    category,
    count: products.length,
    stats: {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      medianPrice: median(prices),
      averageRating: rated.length ? rated.reduce((sum, product) => sum + product.rating, 0) / rated.length : null,
      topSeller: top && top.sold > 0 ? { product: top.product, sold: top.sold } : null,
    },
    checks: input.checklists?.[slug] ?? guideChecklists[slug] ?? [],
    picks,
  }
}

/** Categorias que têm produtos suficientes para um guia. */
export function guideSlugs(input: Input) {
  return input.categories.filter((category) => input.products.filter((product) => product.category === category.slug).length >= 3).map((category) => category.slug)
}
