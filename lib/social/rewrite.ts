import { chat, DeepseekError, type DeepseekConfig } from '@/lib/ai/deepseek'
import { CAPTION_LIMIT, escapeHtml, MESSAGE_LIMIT, priceLine, proofLine, cleanTitle, type PostFacts } from './compose'

/**
 * Reescrita opcional do texto da postagem por IA. A IA só muda o **tom e a estrutura**; todo número vem do que
 * já está no texto-base, e `validateRewrite` recusa qualquer coisa que invente preço, desconto, nota, urgência
 * ou escassez. Se a resposta não passa na validação, o texto-base (modelo fixo) continua valendo.
 */

const money = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Frases que prometem o que não sabemos: urgência, escassez, garantia, "menor preço". */
const unicodeWord = (source: string) => new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${source})(?![\p{L}\p{N}])`, 'iu')
const bannedClaims = [
  'só hoje', 'acaba(?:m)? (?:hoje|amanhã|em)', 'últimas? unidades?', 'estoque (?:limitado|acabando)', 'corr(?:a|e)', 'não perca',
  'garantid[oa]', 'menor preço', 'melhor preço', 'preço histórico', 'imperdível', 'frete grátis', 'cupom', 'de graça', 'grátis',
].map(unicodeWord).concat(/100 ?%/)

export type RewriteCheck = { ok: true; text: string } | { ok: false; reason: string }

const numbersIn = (value: string) => (value.match(/\d+(?:[.,]\d+)?/g) ?? []).map((item) => item.replace(/^0+(?=\d)/, ''))

/**
 * Confere a resposta da IA contra os fatos. Devolve o corpo já com o aviso de afiliado anexado (a IA não o escreve).
 * Regras: contém o link e o preço exatos; todo número do texto existe nos fatos ou no nome do produto; só <b> e <i>;
 * nenhuma frase de urgência, escassez ou garantia; sem outros links, menções ou hashtags; cabe no limite.
 */
export function validateRewrite(raw: string, facts: PostFacts, link: string, options: { caption?: boolean } = {}): RewriteCheck {
  const body = raw.trim().replace(/^```(?:html)?\s*|\s*```$/g, '').trim()
  if (body.length < 20) return { ok: false, reason: 'Texto curto demais.' }
  const limit = options.caption ? CAPTION_LIMIT : MESSAGE_LIMIT
  const escapedLink = escapeHtml(link)

  if (!body.includes(escapedLink) && !body.includes(link)) return { ok: false, reason: 'O link de afiliado não está no texto.' }
  if (!body.includes(`R$ ${money(facts.price)}`)) return { ok: false, reason: 'O preço atual não está no texto.' }

  // Tags: só <b>, </b>, <i>, </i>.
  const tags = body.match(/<[^>]*>/g) ?? []
  if (tags.some((tag) => !/^<\/?[bi]>$/.test(tag))) return { ok: false, reason: 'O texto usa formatação não permitida.' }

  // Nenhum outro link, @ ou hashtag.
  const withoutLink = body.split(escapedLink).join(' ').split(link).join(' ')
  if (/https?:\/\/|www\.|t\.me\//i.test(withoutLink)) return { ok: false, reason: 'O texto traz outro link.' }
  if (/(^|\s)[@#]\w/.test(withoutLink)) return { ok: false, reason: 'O texto traz menção ou hashtag.' }

  for (const claim of bannedClaims) if (claim.test(withoutLink)) return { ok: false, reason: 'O texto promete urgência, escassez ou garantia que não temos como confirmar.' }

  // Todo número precisa existir nos fatos (preço, nota, vendas, desconto) ou no nome do produto.
  const allowed = new Set<string>([
    ...numbersIn(money(facts.price)), ...numbersIn(facts.originalPrice ? money(facts.originalPrice) : ''),
    ...numbersIn(String(Math.round(facts.discountPercent ?? 0))), ...numbersIn(proofLine(facts)), ...numbersIn(priceLine(facts)),
    ...numbersIn(facts.name), ...numbersIn(String(facts.soldCount)), ...numbersIn(facts.soldCount.toLocaleString('pt-BR')), ...numbersIn(cleanTitle(facts.name)),
  ])
  // "nota 4,8 de 5": o 5 é a escala da nota, não um dado novo.
  if (facts.rating > 0) allowed.add('5')
  // "TWS 5.3" no nome autoriza também "5" e "3": a IA costuma abreviar versões e medidas do próprio título.
  for (const number of numbersIn(facts.name)) for (const part of number.split(/[.,]/)) allowed.add(part)
  // Ano e dias da semana não entram; números soltos "1", "2" em listas pequenas são tolerados.
  const stray = numbersIn(withoutLink.replace(/<[^>]*>/g, ' ')).filter((number) => !allowed.has(number) && !/^[0-3]$/.test(number))
  if (stray.length) return { ok: false, reason: `O texto cita números que não estão nos dados da oferta (${[...new Set(stray)].slice(0, 3).join(', ')}).` }

  // "de R$ X": só com preço anterior real.
  const amounts = [...withoutLink.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((match) => match[1])
  const okAmounts = new Set([money(facts.price), ...(facts.originalPrice ? [money(facts.originalPrice)] : [])])
  if (amounts.some((amount) => !okAmounts.has(amount))) return { ok: false, reason: 'O texto cita um valor que não é o preço da oferta.' }
  if ((facts.originalPrice === null || (facts.discountPercent ?? 0) < 5) && /\d+\s*%/.test(withoutLink)) return { ok: false, reason: 'O texto cita desconto que a Shopee não informou.' }

  const text = body
  if (text.length > limit) return { ok: false, reason: 'O texto passa do limite do Telegram.' }
  return { ok: true, text }
}

const systemPrompt = `Você escreve postagens curtas para um canal de ofertas do Telegram, em português do Brasil.
Regras obrigatórias:
- Use SOMENTE os dados fornecidos. Nunca invente preço, desconto, nota, número de vendas, frete, cupom, prazo ou estoque.
- Mantenha o preço atual exatamente como fornecido (ex.: R$ 39,90) e o link exatamente como fornecido, sem encurtar nem alterar.
- Não use urgência nem escassez ("só hoje", "últimas unidades", "corra", "acaba"), nem "garantido", "menor preço" ou "melhor preço".
- Tom natural, de uma pessoa recomendando um achado; sem exagero, sem CAPS LOCK, no máximo 2 emojis.
- Formatação permitida: apenas <b>negrito</b> e <i>itálico</i>. Nenhum outro HTML, hashtag ou menção.
- Se citar nota ou vendas, copie o número exatamente como foi fornecido (ou escreva sem número, como "muito vendido"). Não arredonde nem converta.
- Até 4 linhas curtas. Não escreva aviso de afiliado: ele é adicionado depois.
Responda só com o texto da postagem.`

const variations = [
  'Comece destacando o benefício principal do produto.',
  'Comece com uma frase curta e direta, como quem indica para um amigo.',
  'Comece pelo preço e depois diga por que vale olhar.',
  'Seja objetivo: o que é, para quem serve e quanto custa.',
]

/** Pede à IA uma nova redação e valida. Nunca lança: em qualquer falha devolve o motivo e o chamador mantém o texto-base. */
export async function rewriteWithAi(input: {
  config: DeepseekConfig; facts: PostFacts; link: string; seed: number; caption?: boolean; fetchImpl?: typeof fetch
}): Promise<RewriteCheck> {
  const { facts, link } = input
  const dataLines = [
    `Produto: ${cleanTitle(facts.name, 120)}`,
    `Preço atual: R$ ${money(facts.price)}`,
    facts.originalPrice && (facts.discountPercent ?? 0) >= 5 ? `Preço anterior informado pela Shopee: R$ ${money(facts.originalPrice)} (${Math.round(facts.discountPercent ?? 0)}% a menos)` : 'Sem desconto informado.',
    facts.rating > 0 ? `Nota: ${facts.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de 5` : null,
    facts.soldCount >= 50 ? `Vendas: ${facts.soldCount.toLocaleString('pt-BR')}` : null,
    `Link (copie exatamente): ${link}`,
  ].filter(Boolean).join('\n')
  try {
    const answer = await chat(input.config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${variations[input.seed % variations.length]}\n\nDados:\n${dataLines}` },
    ], { maxTokens: 320, temperature: 0.8 }, input.fetchImpl)
    return validateRewrite(answer, facts, link, { caption: input.caption })
  } catch (error) {
    return { ok: false, reason: error instanceof DeepseekError ? error.message : 'Falha inesperada na IA.' }
  }
}
