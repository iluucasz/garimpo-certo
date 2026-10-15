import { deliverDue, expireOldPending, loadSocialSettings, planToday, saveSocialState, type SocialState } from './store'
import { telegramConfig } from './telegram'
import { loadContentSettings, planContentToday } from './content-store'

let running: Promise<SocialState> | null = null

async function execute(now: number): Promise<SocialState> {
  const settings = await loadSocialSettings()
  const base: SocialState = { at: new Date(now).toISOString(), planned: 0, sent: 0, failed: 0, expired: 0, note: null }

  // Instagram e TikTok: prepara o conteúdo do dia (a publicação é à mão). Falhar aqui nunca derruba o Telegram.
  let contentNote: string | null = null
  try {
    const content = await loadContentSettings()
    if (content.autoPlan) {
      const plan = await planContentToday(content, now)
      const total = plan.created.reduce((sum, item) => sum + item.count, 0)
      if (total > 0) contentNote = `Instagram e TikTok: ${total} post(s) preparado(s) para hoje.`
    }
  } catch (error) {
    console.error('[content] planejamento falhou', error instanceof Error ? error.message : error)
  }

  if (settings.mode === 'off') {
    const state = { ...base, note: ['As postagens estão desligadas.', contentNote].filter(Boolean).join(' ') }
    await saveSocialState(state)
    return state
  }
  const notes: string[] = contentNote ? [contentNote] : []
  const expired = await expireOldPending(now)

  let planned = 0
  if (settings.autoPlan) {
    const plan = await planToday(settings, now)
    planned = plan.created
    if (plan.reason && plan.created === 0 && plan.ranked.length === 0 && !/cota de hoje/.test(plan.reason)) notes.push(plan.reason)
  }

  let delivery = { sent: 0, failed: 0, expired: 0 }
  if (telegramConfig()) delivery = await deliverDue(now)
  else notes.push('O bot do Telegram não está configurado: as postagens ficam na fila, sem envio.')

  const state: SocialState = { ...base, planned, sent: delivery.sent, failed: delivery.failed, expired: expired + delivery.expired, note: notes.join(' ') || null }
  await saveSocialState(state)
  return state
}

/** Uma execução por vez por instância (worker e botão do painel). */
export function runSocialQueue(now = Date.now()): Promise<SocialState> {
  if (!running) running = execute(now).finally(() => { running = null })
  return running
}
