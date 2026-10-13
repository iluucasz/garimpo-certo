import { deliverDue, expireOldPending, loadSocialSettings, planToday, saveSocialState, type SocialState } from './store'
import { telegramConfig } from './telegram'

let running: Promise<SocialState> | null = null

async function execute(now: number): Promise<SocialState> {
  const settings = await loadSocialSettings()
  const base: SocialState = { at: new Date(now).toISOString(), planned: 0, sent: 0, failed: 0, expired: 0, note: null }
  if (settings.mode === 'off') {
    const state = { ...base, note: 'As postagens estão desligadas.' }
    await saveSocialState(state)
    return state
  }
  const notes: string[] = []
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
