/**
 * Envio pela API oficial de bots do Telegram. Sem dependência extra, sem imports do Next (o worker usa este arquivo).
 * O token nunca entra em mensagem de erro nem em log.
 */

export type TelegramConfig = { token: string; chatId: string }

/** `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` (`@canal` ou o número `-100…`). Sem os dois, o envio fica desligado. */
export function telegramConfig(env: Record<string, string | undefined> = process.env): TelegramConfig | null {
  const token = (env.TELEGRAM_BOT_TOKEN ?? env.telegram_bot_token ?? '').trim()
  const chatId = (env.TELEGRAM_CHAT_ID ?? env.telegram_chat_id ?? '').trim()
  return token && chatId ? { token, chatId } : null
}

export class TelegramError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter?: number) {
    super(message)
    this.name = 'TelegramError'
  }
}

type Fetch = typeof fetch
type ApiResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function call<T>(config: TelegramConfig, method: string, payload: Record<string, unknown>, fetchImpl: Fetch, attempt = 1): Promise<T> {
  let response: Response
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    // A mensagem original pode conter a URL (e o token): não repassa.
    throw new TelegramError(error instanceof Error && error.name === 'TimeoutError' ? 'O Telegram demorou demais para responder.' : 'Não foi possível falar com o Telegram.', 0)
  }
  const body = await response.json().catch(() => null) as ApiResponse<T> | null
  if (response.status === 429 && attempt < 2) {
    const wait = Math.min(body?.parameters?.retry_after ?? 5, 30)
    await sleep(wait * 1000)
    return call(config, method, payload, fetchImpl, attempt + 1)
  }
  if (!response.ok || !body?.ok) {
    throw new TelegramError(body?.description ?? `O Telegram respondeu ${response.status}.`, response.status, body?.parameters?.retry_after)
  }
  return body.result as T
}

export type SendResult = { messageId: string; usedPhoto: boolean }

/** Envia a postagem: foto com legenda quando há imagem; se o Telegram não conseguir baixar a imagem, só o texto. */
export async function sendTelegramPost(config: TelegramConfig, post: { text: string; imageUrl: string | null }, fetchImpl: Fetch = fetch): Promise<SendResult> {
  if (post.imageUrl) {
    try {
      const sent = await call<{ message_id: number }>(config, 'sendPhoto', { chat_id: config.chatId, photo: post.imageUrl, caption: post.text, parse_mode: 'HTML' }, fetchImpl)
      return { messageId: String(sent.message_id), usedPhoto: true }
    } catch (error) {
      // 400 por causa da imagem (URL inacessível, tipo inválido): cai para texto. Outros erros sobem.
      if (!(error instanceof TelegramError) || error.status !== 400 || !/photo|image|url|http|file/i.test(error.message)) throw error
    }
  }
  const sent = await call<{ message_id: number }>(config, 'sendMessage', {
    chat_id: config.chatId, text: post.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
  }, fetchImpl)
  return { messageId: String(sent.message_id), usedPhoto: false }
}

/** Confere o token e o acesso ao canal sem publicar nada (`getMe` + `getChat`). */
export async function checkTelegram(config: TelegramConfig, fetchImpl: Fetch = fetch) {
  const bot = await call<{ id: number; username?: string }>(config, 'getMe', {}, fetchImpl)
  const chat = await call<{ title?: string; type?: string; username?: string }>(config, 'getChat', { chat_id: config.chatId }, fetchImpl)
  const me = await call<{ status?: string }>(config, 'getChatMember', { chat_id: config.chatId, user_id: bot.id }, fetchImpl).catch(() => null)
  return { bot: bot.username ?? null, chatTitle: chat.title ?? chat.username ?? null, chatType: chat.type ?? null, botStatus: me?.status ?? null }
}
