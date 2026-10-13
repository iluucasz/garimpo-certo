/**
 * Worker de importação do catálogo, para rodar na VPS (Docker) em vez do Vercel Cron.
 *
 * Uma vez por dia, no horário `IMPORT_AT` (padrão 06:00, fuso do contêiner via `TZ`), executa a mesma
 * importação do site (`runCatalogImport`: busca na Shopee, grava no banco, arquiva o que saiu, registra a
 * execução em sync_job_runs) e depois pede ao site para invalidar o cache (`POST /api/v1/cron/revalidate`).
 *
 * Também traz as comissões reais da Shopee (`conversionReport`) para o banco: logo depois de cada importação e
 * a cada `CONVERSIONS_EVERY_MIN` minutos (padrão 180; 0 desliga). É o que alimenta os números de comissão do painel.
 *
 * Variáveis: DATABASE_URL, SHOPEE_AFFILIATE_APP_ID, SHOPEE_AFFILIATE_APP_SECRET (obrigatórias);
 * SITE_URL e CRON_SECRET (para o aviso ao site; sem elas o cache do site expira sozinho em 5 min);
 * IMPORT_AT (HH:MM), TZ, RUN_ON_START=1 (roda ao subir), CONVERSIONS_EVERY_MIN, SOCIAL_EVERY_MIN (padrão 5; 0 desliga as postagens),
 * TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (sem eles as postagens ficam na fila, sem envio).
 *
 * Uso: `node importer.mjs` (agenda) · `node importer.mjs --once` (roda e sai) · `--conversions` (só as comissões, uma vez)
 * · `--check` (valida a configuração).
 */
import { runEngine } from '@/lib/engine/run'
import { runSocialQueue } from '@/lib/social/run'
import { runConversionSync } from '@/lib/providers/shopee/conversions-run'
import { runCatalogImport } from '@/lib/providers/shopee/run'

const log = (event: string, data: Record<string, unknown> = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }))

const RETRY_DELAYS_MS = [30 * 60_000, 60 * 60_000]

export function parseTime(value: string) {
  const match = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null
}

/** Milissegundos até a próxima ocorrência de HH:MM no horário local. */
export function msUntilNext(at: { hours: number; minutes: number }, now = new Date()) {
  const next = new Date(now)
  next.setHours(at.hours, at.minutes, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function missingConfig() {
  return ['DATABASE_URL', 'SHOPEE_AFFILIATE_APP_ID', 'SHOPEE_AFFILIATE_APP_SECRET'].filter((name) => !(process.env[name] ?? '').trim())
}

async function notifySite() {
  const site = (process.env.SITE_URL ?? '').trim().replace(/\/$/, '')
  const secret = (process.env.CRON_SECRET ?? '').trim()
  if (!site || !secret) { log('site_notify_skipped', { reason: 'SITE_URL ou CRON_SECRET ausente' }); return }
  try {
    const response = await fetch(`${site}/api/v1/cron/revalidate`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(20_000) })
    log('site_notified', { status: response.status })
  } catch (error) {
    log('site_notify_failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

/** Comissões reais da Shopee. Falhar aqui nunca derruba a importação do catálogo. */
async function syncConversions(trigger: string) {
  const startedAt = Date.now()
  try {
    const result = await runConversionSync()
    log('conversions_synced', { trigger, ...result, wallMs: Date.now() - startedAt })
    return result.created + result.updated > 0
  } catch (error) {
    log('conversions_failed', { trigger, error: error instanceof Error ? error.message : String(error), wallMs: Date.now() - startedAt })
    return false
  }
}

/** A Engine (faxina e radar sazonal) roda depois de importar e de sincronizar comissões. Falhar aqui nunca derruba nada. */
async function runEngineStep() {
  const startedAt = Date.now()
  try {
    const state = await runEngine()
    log('engine_ran', { mode: state.mode, created: state.created, refreshed: state.refreshed, expired: state.expired, applied: state.applied, note: state.note, wallMs: Date.now() - startedAt })
  } catch (error) {
    log('engine_failed', { error: error instanceof Error ? error.message : String(error), wallMs: Date.now() - startedAt })
  }
}

/** Planeja e envia as postagens do canal. Falhar aqui nunca derruba o resto. */
async function socialStep(trigger: string) {
  try {
    const state = await runSocialQueue()
    if (state.planned || state.sent || state.failed || state.expired) log('social_ran', { trigger, planned: state.planned, sent: state.sent, failed: state.failed, expired: state.expired, note: state.note })
  } catch (error) {
    log('social_failed', { trigger, error: error instanceof Error ? error.message : String(error) })
  }
}

async function socialLoop(everyMinutes: number, isStopping: () => boolean) {
  while (!isStopping()) {
    await sleep(everyMinutes * 60_000)
    await socialStep('interval')
  }
}

async function conversionLoop(everyMinutes: number, isStopping: () => boolean) {
  while (!isStopping()) {
    await sleep(everyMinutes * 60_000)
    if (await syncConversions('interval')) await notifySite()
  }
}

async function runOnce() {
  const startedAt = Date.now()
  log('import_started')
  try {
    const result = await runCatalogImport()
    log('import_finished', { ...result, wallMs: Date.now() - startedAt })
    await syncConversions('after_import')
    await runEngineStep()
    await notifySite()
    return true
  } catch (error) {
    log('import_failed', { error: error instanceof Error ? error.message : String(error), wallMs: Date.now() - startedAt })
    return false
  }
}

async function runWithRetries() {
  if (await runOnce()) return
  for (const delay of RETRY_DELAYS_MS) {
    log('retry_scheduled', { inMinutes: Math.round(delay / 60_000) })
    await sleep(delay)
    if (await runOnce()) return
  }
  log('gave_up_until_next_day')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const missing = missingConfig()
  const at = parseTime(process.env.IMPORT_AT ?? '06:00')
  if (!at) { log('invalid_config', { IMPORT_AT: process.env.IMPORT_AT }); process.exit(2) }
  if (missing.length) { log('invalid_config', { missing }); process.exit(2) }

  if (args.has('--check')) {
    log('config_ok', { importAt: process.env.IMPORT_AT ?? '06:00', tz: process.env.TZ ?? 'sistema', nextRunInMinutes: Math.round(msUntilNext(at) / 60_000), notifySite: Boolean(process.env.SITE_URL && process.env.CRON_SECRET), conversionsEveryMin: Number(process.env.CONVERSIONS_EVERY_MIN ?? 180) })
    process.exit(0)
  }
  if (args.has('--conversions')) { await syncConversions('manual'); process.exit(0) }
  if (args.has('--engine')) { await runEngineStep(); process.exit(0) }
  if (args.has('--social')) { await socialStep('manual'); process.exit(0) }
  if (args.has('--once')) process.exit((await runOnce()) ? 0 : 1)

  let stopping = false
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { stopping = true; log('stopping', { signal }); process.exit(0) })

  const everyMinutes = Number(process.env.CONVERSIONS_EVERY_MIN ?? 180)
  log('worker_started', { importAt: process.env.IMPORT_AT ?? '06:00', tz: process.env.TZ ?? 'sistema', conversionsEveryMin: everyMinutes > 0 ? everyMinutes : 'desligado' })
  if (Number.isFinite(everyMinutes) && everyMinutes > 0) void conversionLoop(everyMinutes, () => stopping)
  const socialEvery = Number(process.env.SOCIAL_EVERY_MIN ?? 5)
  if (Number.isFinite(socialEvery) && socialEvery > 0) void socialLoop(socialEvery, () => stopping)
  if (process.env.RUN_ON_START === '1') await runWithRetries()
  while (!stopping) {
    const wait = msUntilNext(at)
    log('waiting', { nextRunInMinutes: Math.round(wait / 60_000) })
    await sleep(wait)
    await runWithRetries()
  }
}

// Só executa quando chamado como programa (os testes importam as funções de horário).
if (process.argv[1] && /importer\.(mjs|ts)$/.test(process.argv[1])) void main()
