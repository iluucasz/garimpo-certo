/**
 * Cliente mínimo da API do DeepSeek (compatível com o formato de chat da OpenAI). Sem dependências e sem imports
 * do Next: o worker da VPS usa este arquivo. A chave nunca aparece em erro nem em log.
 *
 * Privacidade: só vão para a API dados públicos do catálogo (nome, preço, nota). Nunca dados de visitantes.
 */

export type DeepseekConfig = { apiKey: string; model: string; baseUrl: string }

/** A chave está no `.env` como `deep_seek` (minúsculo) ou `DEEPSEEK_API_KEY`. */
export function deepseekConfig(env: Record<string, string | undefined> = process.env): DeepseekConfig | null {
  const apiKey = (env.DEEPSEEK_API_KEY ?? env.deep_seek ?? '').trim()
  if (!apiKey) return null
  return { apiKey, model: (env.DEEPSEEK_MODEL ?? 'deepseek-chat').trim() || 'deepseek-chat', baseUrl: (env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '') }
}

export class DeepseekError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'DeepseekError'
  }
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chat(
  config: DeepseekConfig,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let response: Response
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, max_tokens: options.maxTokens ?? 400, temperature: options.temperature ?? 0.7, stream: false }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    })
  } catch (error) {
    throw new DeepseekError(error instanceof Error && error.name === 'TimeoutError' ? 'A IA demorou demais para responder.' : 'Não foi possível falar com a IA.', 0)
  }
  const body = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null
  if (!response.ok) {
    const reason = response.status === 401 ? 'Chave da IA recusada.' : response.status === 402 ? 'Sem saldo na conta da IA.' : response.status === 429 ? 'Limite de uso da IA atingido.' : (body?.error?.message ?? `A IA respondeu ${response.status}.`)
    throw new DeepseekError(reason, response.status)
  }
  const content = body?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new DeepseekError('A IA respondeu sem texto.', response.status)
  return content
}
