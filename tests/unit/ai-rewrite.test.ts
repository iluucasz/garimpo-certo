import { describe, expect, it, vi } from 'vitest'
import { chat, DeepseekError, deepseekConfig } from '@/lib/ai/deepseek'
import type { PostFacts } from '@/lib/social/compose'
import { rewriteWithAi, validateRewrite } from '@/lib/social/rewrite'

const facts: PostFacts = { name: 'Fone Bluetooth TWS 5.3 Sem Fio', price: 39.9, originalPrice: 59.9, discountPercent: 33.4, rating: 4.8, soldCount: 1250 }
const link = 'https://s.shopee.com.br/abc123'
const good = `Esse fone TWS 5.3 pegou meu olho 👀\nSai por <b>R$ 39,90</b> (antes R$ 59,90), nota 4,8 e mais de 1,3 mil vendas.\n${link}`

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const completion = (content: string) => json({ choices: [{ message: { content } }] })

describe('validação da reescrita por IA', () => {
  it('aceita um texto fiel aos dados e anexa o aviso de afiliado', () => {
    const result = validateRewrite(good, facts, link)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).not.toContain('Link de afiliado')
  })

  it('exige o link e o preço exatos', () => {
    expect(validateRewrite(good.replace(link, 'https://s.shopee.com.br/outro'), facts, link)).toMatchObject({ ok: false, reason: expect.stringContaining('link') })
    expect(validateRewrite(good.replace('R$ 39,90', 'R$ 35,00'), facts, link)).toMatchObject({ ok: false })
  })

  it('recusa número, valor e desconto inventados', () => {
    expect(validateRewrite(good.replace('nota 4,8', 'nota 4,9'), facts, link)).toMatchObject({ ok: false, reason: expect.stringContaining('números') })
    expect(validateRewrite(`${good}\nParcela em 12x de R$ 3,32`, facts, link)).toMatchObject({ ok: false })
    const noDiscount: PostFacts = { ...facts, originalPrice: null, discountPercent: null }
    expect(validateRewrite('Fone TWS 5.3 por R$ 39,90, nota 4,8.\n' + link + '\nAproveite 30% off', noDiscount, link)).toMatchObject({ ok: false })
  })

  it('recusa urgência, escassez e garantia', () => {
    for (const phrase of ['Só hoje!', 'Últimas unidades', 'Corra antes que acabe', 'Menor preço do ano', 'Qualidade garantida', 'Frete grátis', 'Use o cupom']) {
      expect(validateRewrite(`${good}\n${phrase}`, facts, link), phrase).toMatchObject({ ok: false })
    }
  })

  it('recusa HTML, outros links, hashtags e menções', () => {
    expect(validateRewrite(`${good}\n<a href="https://x.test">aqui</a>`, facts, link)).toMatchObject({ ok: false })
    expect(validateRewrite(`${good}\nVeja também https://t.me/canal`, facts, link)).toMatchObject({ ok: false })
    expect(validateRewrite(`${good}\n#achadinho`, facts, link)).toMatchObject({ ok: false })
    expect(validateRewrite(`${good}\n@fulano`, facts, link)).toMatchObject({ ok: false })
  })

  it('tira a cerca de código que a IA às vezes adiciona', () => {
    expect(validateRewrite('```html\n' + good + '\n```', facts, link).ok).toBe(true)
  })

  it('respeita o limite de legenda de foto', () => {
    const long = `${good}\n${'Texto longo sem números. '.repeat(60)}`
    expect(validateRewrite(long, facts, link, { caption: true })).toMatchObject({ ok: false, reason: expect.stringContaining('limite') })
  })
})

describe('cliente do DeepSeek', () => {
  it('lê a chave de DEEPSEEK_API_KEY ou de deep_seek', () => {
    expect(deepseekConfig({})).toBeNull()
    expect(deepseekConfig({ deep_seek: ' sk-1 ' })).toMatchObject({ apiKey: 'sk-1', model: 'deepseek-chat' })
    expect(deepseekConfig({ DEEPSEEK_API_KEY: 'sk-2', deep_seek: 'sk-1' })?.apiKey).toBe('sk-2')
  })

  it('envia o pedido com a chave só no cabeçalho', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('olá'))
    const config = { apiKey: 'sk-segredo', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' }
    expect(await chat(config, [{ role: 'user', content: 'oi' }], {}, fetchMock as unknown as typeof fetch)).toBe('olá')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init.headers.authorization).toBe('Bearer sk-segredo')
    expect(init.body).not.toContain('sk-segredo')
  })

  it('traduz erros comuns sem expor a chave', async () => {
    const config = { apiKey: 'sk-segredo', model: 'm', baseUrl: 'https://api.deepseek.com' }
    const run = (status: number) => chat(config, [], {}, vi.fn().mockResolvedValue(json({ error: { message: 'x' } }, status)) as unknown as typeof fetch).catch((error) => error)
    expect((await run(401)).message).toMatch(/recusada/)
    expect((await run(402)).message).toMatch(/saldo/)
    expect((await run(429)).message).toMatch(/Limite/)
    const network = await chat(config, [], {}, vi.fn().mockRejectedValue(new Error('fetch failed Bearer sk-segredo')) as unknown as typeof fetch).catch((error) => error)
    expect(network).toBeInstanceOf(DeepseekError)
    expect(String(network.message)).not.toContain('sk-segredo')
  })
})

describe('reescrita ponta a ponta (com IA simulada)', () => {
  const config = { apiKey: 'sk', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' }

  it('usa a resposta da IA quando passa na validação', async () => {
    const result = await rewriteWithAi({ config, facts, link, seed: 2, fetchImpl: vi.fn().mockResolvedValue(completion(good)) as unknown as typeof fetch })
    expect(result.ok).toBe(true)
  })

  it('manda à IA só dados públicos da oferta, com o link e o preço', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion(good))
    await rewriteWithAi({ config, facts, link, seed: 0, fetchImpl: fetchMock as unknown as typeof fetch })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const prompt = body.messages.map((message: { content: string }) => message.content).join('\n')
    expect(prompt).toContain('R$ 39,90')
    expect(prompt).toContain(link)
    expect(prompt).toContain('Preço anterior informado pela Shopee')
    expect(body.max_tokens).toBeLessThanOrEqual(400)
  })

  it('sem preço anterior, avisa à IA que não há desconto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion(good))
    await rewriteWithAi({ config, facts: { ...facts, originalPrice: null, discountPercent: null }, link, seed: 0, fetchImpl: fetchMock as unknown as typeof fetch })
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages.map((message: { content: string }) => message.content).join('\n')
    expect(prompt).toContain('Sem desconto informado.')
  })

  it('devolve o motivo, sem lançar, quando a IA inventa ou falha', async () => {
    const invented = await rewriteWithAi({ config, facts, link, seed: 1, fetchImpl: vi.fn().mockResolvedValue(completion(`${good} Só hoje!`)) as unknown as typeof fetch })
    expect(invented).toMatchObject({ ok: false })
    const down = await rewriteWithAi({ config, facts, link, seed: 1, fetchImpl: vi.fn().mockResolvedValue(json({}, 500)) as unknown as typeof fetch })
    expect(down).toMatchObject({ ok: false })
  })
})

describe('palavras proibidas não pegam palavras parecidas', () => {
  it('"correr" e "garantia" fora do contexto de promessa não bloqueiam a descrição', () => {
    const text = `Tênis leve para correr 🏃 por R$ 39,90, nota 4,8.\n${link}`
    // "correr" não é "corra"/"corre": passa.
    expect(validateRewrite(text, { ...facts, name: 'Tênis leve para correr' }, link).ok).toBe(true)
  })
})

describe('escala da nota', () => {
  it('"4,8 de 5" não conta como número inventado, mas outras notas continuam recusadas', () => {
    const plain = { ...facts, name: 'Escova secadora elétrica', originalPrice: null, discountPercent: null }
    const text = `Escova por <b>R$ 39,90</b>. Nota 4,8 de 5 e 1.250 vendas.
${link}`
    expect(validateRewrite(text, plain, link).ok).toBe(true)
    expect(validateRewrite(text.replace('4,8 de 5', '4,9 de 5'), plain, link).ok).toBe(false)
    expect(validateRewrite(text.replace('1.250', '2.500'), plain, link).ok).toBe(false)
  })
})
