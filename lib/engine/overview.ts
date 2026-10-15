import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { countCatalog } from '@/lib/db/repositories/catalog-import'
import { getCommissionReport } from '@/lib/db/repositories/commissions'
import { getOpsHealth, type HealthCheck } from '@/lib/ops/health'
import { loadSocialSettings, readSocialState } from '@/lib/social/store'
import { contentToday, loadContentSettings } from '@/lib/social/content-store'
import { telegramConfig } from '@/lib/social/telegram'
import { readHeartbeat, workerState } from './heartbeat'
import { categoryBoosts, categoryPerformance, type CategoryPerformance } from './rules'
import { activeCategoryBonuses, kindLabels, listProposals, loadCategoryStats, loadEngineSettings, loadImportSettings, readRunState, type EngineMode } from './store'

/**
 * Tudo o que a central da Engine mostra, de uma vez: o que ela faz, quando rodou, o que vem a seguir, o que espera
 * aprovação e o que aprendeu. Só leitura: nada aqui muda dado.
 */

export type TaskState = 'ok' | 'attention' | 'idle' | 'off'

export type EngineTask = {
  id: 'import' | 'commissions' | 'engine' | 'learn' | 'social' | 'content'
  title: string
  /** O que ela faz, em uma frase. */
  what: string
  enabled: boolean
  state: TaskState
  /** Quando roda. */
  schedule: string
  last: { at: string; status: string; summary: string } | null
  nextAt: string | null
  /** Aviso curto: o que falta ou por que está parada. */
  note: string | null
  /** Slug do módulo do painel onde se configura. */
  href: string
}

export type ActivityItem = { at: string; kind: 'import' | 'commissions' | 'engine' | 'post' | 'proposal'; tone: 'ok' | 'bad' | 'neutral'; title: string; detail: string }

export type ProposalView = {
  id: string; kind: string; kindLabel: string; title: string; reason: string; evidence: Record<string, unknown>
  status: string; createdAt: string; expiresAt: string | null
}
export type PostView = { id: string; name: string; text: string; imageUrl: string | null; scheduledFor: string | null; source: string; campaign: string; price: number | null }

export type EngineOverview = {
  generatedAt: string
  master: { engine: EngineMode; social: 'on' | 'off'; requireApproval: boolean; importEnabled: boolean; telegramConfigured: boolean }
  worker: { state: 'online' | 'stale' | 'offline' | 'unknown'; lastBeatAt: string | null; startedAt: string | null }
  tasks: EngineTask[]
  approvals: { proposals: ProposalView[]; posts: PostView[] }
  today: { planned: number; sent: number; pending: number; failed: number; dailyLimit: number; nextPostAt: string | null }
  catalog: { products: number; offers: number; withAffiliate: number }
  commissions: { days: number; pending: number; confirmed: number; telegram: number; conversions: number }
  learning: {
    enabled: boolean; windowDays: number; siteClicks: number; minSiteClicks: number; enough: boolean
    categories: (CategoryPerformance & { boost: number; bonus: number })[]
  }
  attention: HealthCheck[]
  activity: ActivityItem[]
}

const HOUR = 3_600_000

/** Próximo horário (HH:MM de Brasília, UTC−3 sem horário de verão) em ISO. */
export function nextDailyAt(time: string, now = Date.now()): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  const hour = match ? Math.min(23, Number(match[1])) : 6
  const minute = match ? Math.min(59, Number(match[2])) : 0
  const base = new Date(now)
  let next = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour + 3, minute)
  if (next <= now) next += 24 * HOUR
  return new Date(next).toISOString()
}

type RunRow = { job_type: string; status: string; started_at: string; finished_at: string | null; processed_count: number; created_count: number; updated_count: number; rejected_count: number }

const runStatusLabel: Record<string, string> = { succeeded: 'concluída', failed: 'falhou', partial: 'parcial', running: 'em andamento' }
const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null

function lastRun(rows: RunRow[], type: string, summary: (row: RunRow) => string) {
  const row = rows.find((item) => item.job_type === type)
  if (!row) return null
  return { at: new Date(row.finished_at ?? row.started_at).toISOString(), status: row.status, summary: summary(row) }
}

export async function getEngineOverview(now = Date.now()): Promise<EngineOverview> {
  const [engine, importSettings, social, engineState, socialState, beat, contentSettings] = await Promise.all([
    loadEngineSettings(), loadImportSettings(), loadSocialSettings(), readRunState(), readSocialState(), readHeartbeat(), loadContentSettings(),
  ])
  const telegramConfigured = Boolean(telegramConfig())

  const [runs, postToday, pendingPosts, nextPost, catalog, commissions, stats, bonuses, pendingProposals, health, doneRuns, donePosts, doneProposals, contentSummary] = await Promise.all([
    db.execute(sql`
      select distinct on (j.job_type) j.job_type, r.status::text as status, r.started_at, r.finished_at,
             r.processed_count, r.created_count, r.updated_count, r.rejected_count
      from sync_job_runs r join sync_jobs j on j.id = r.sync_job_id
      where j.job_type in ('catalog_import', 'conversion_sync', 'engine_run')
      order by j.job_type, r.started_at desc`),
    db.execute(sql`
      select status, count(*)::int as n from social_posts
      where channel = 'telegram' and scheduled_for is not null
        and (scheduled_for at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      group by status`),
    db.execute(sql`
      select p.id, p.text, p.image_url, p.scheduled_for, p.source, p.campaign, p.facts
      from social_posts p where p.channel = 'telegram' and p.status = 'pending'
      order by p.scheduled_for asc nulls last, p.created_at asc limit 50`),
    db.execute(sql`
      select min(scheduled_for) as at from social_posts
      where channel = 'telegram' and status in ('approved', 'pending') and scheduled_for > now()`),
    countCatalog().catch(() => ({ products: 0, offers: 0, withAffiliate: 0 })),
    getCommissionReport(30).catch(() => null),
    loadCategoryStats(engine.windowDays).catch(() => []),
    activeCategoryBonuses().catch(() => ({} as Record<string, number>)),
    listProposals({ statuses: ['pending'], limit: 100 }),
    getOpsHealth(now).catch(() => null),
    db.execute(sql`
      select j.job_type, r.status::text as status, r.started_at, r.finished_at, r.processed_count, r.created_count, r.updated_count, r.rejected_count
      from sync_job_runs r join sync_jobs j on j.id = r.sync_job_id
      where j.job_type in ('catalog_import', 'conversion_sync', 'engine_run')
      order by r.started_at desc limit 25`),
    db.execute(sql`
      select id, status, sent_at, updated_at, error, facts from social_posts
      where channel = 'telegram' and status in ('sent', 'failed', 'cancelled')
      order by coalesce(sent_at, updated_at) desc limit 25`),
    db.execute(sql`
      select title, status, decided_at, decision_note, kind from engine_proposals
      where status in ('applied', 'rejected', 'failed') and decided_at is not null
      order by decided_at desc limit 25`),
    contentToday(contentSettings),
  ])

  const runRows = runs.rows as RunRow[]

  // ---- hoje
  const counts = Object.fromEntries((postToday.rows as { status: string; n: number }[]).map((row) => [row.status, Number(row.n)]))
  const planned = Object.values(counts).reduce((sum, n) => sum + n, 0) - (counts.cancelled ?? 0)
  const today = {
    planned, sent: counts.sent ?? 0, pending: (counts.pending ?? 0) + (counts.approved ?? 0), failed: counts.failed ?? 0,
    dailyLimit: social.dailyLimit, nextPostAt: iso((nextPost.rows[0] as { at: string | null } | undefined)?.at),
  }

  // ---- aprendizado
  const perf = categoryPerformance(stats)
  const boosts = categoryBoosts(stats, engine)
  const learning = {
    enabled: engine.learnEnabled && engine.mode !== 'off', windowDays: engine.windowDays, siteClicks: perf.totalClicks, minSiteClicks: engine.minSiteClicks,
    enough: perf.totalClicks >= engine.minSiteClicks,
    categories: perf.categories.map((item) => ({ ...item, boost: boosts[item.slug] ?? 1, bonus: bonuses[item.slug] ?? 0 })),
  }

  // ---- tarefas
  const beatState = workerState(beat, now)
  const importAt = beat?.importAt ?? '06:00'
  const importLast = lastRun(runRows, 'catalog_import', (row) => `${row.created_count} novos, ${row.updated_count} atualizados, ${row.rejected_count} saíram da vitrine`)
  const conversionsLast = lastRun(runRows, 'conversion_sync', (row) => `${row.processed_count} lidas, ${row.created_count} novas, ${row.updated_count} atualizadas`)
  const engineLast = lastRun(runRows, 'engine_run', (row) => `${row.created_count} sugestões novas, ${row.updated_count} atualizadas, ${row.rejected_count} expiradas`)
  const socialLast = socialState
    ? { at: socialState.at, status: socialState.failed > 0 ? 'partial' : 'succeeded', summary: `${socialState.planned} planejadas, ${socialState.sent} enviadas${socialState.failed ? `, ${socialState.failed} com falha` : ''}` }
    : null

  const importNeedsAttention = importLast && importLast.status === 'failed'
  const tasks: EngineTask[] = [
    {
      id: 'import', title: 'Importar produtos da Shopee',
      what: `Busca em cada categoria os produtos com boa nota e vendas, em três faixas de preço (${importSettings.perCategory} por categoria), atualiza preços e tira da vitrine o que saiu da seleção.`,
      enabled: importSettings.enabled, state: !importSettings.enabled ? 'off' : importNeedsAttention ? 'attention' : 'ok',
      schedule: `Todo dia às ${importAt} (Brasília)`, last: importLast,
      nextAt: importSettings.enabled ? nextDailyAt(importAt, now) : null,
      note: !importSettings.enabled ? 'Desligada: o worker não importa às 6h. Dá para importar à mão.' : importNeedsAttention ? 'A última importação falhou. Veja os detalhes em Logs.' : null,
      href: 'engine',
    },
    {
      id: 'commissions', title: 'Sincronizar comissões',
      what: 'Lê na Shopee as vendas feitas pelos seus links e mostra quanto é comissão prevista, confirmada e de qual canal veio.',
      enabled: true, state: conversionsLast?.status === 'failed' ? 'attention' : 'ok',
      schedule: 'A cada 3 horas e depois de cada importação', last: conversionsLast,
      nextAt: conversionsLast ? new Date(new Date(conversionsLast.at).getTime() + 3 * HOUR).toISOString() : null,
      note: conversionsLast ? null : 'Ainda não sincronizou. O worker faz isso sozinho; ou use o botão em Analytics.',
      href: 'analytics',
    },
    {
      id: 'engine', title: 'Faxina do catálogo e radar de datas',
      what: 'Sugere tirar da vitrine o que ninguém abre nem clica e traz termos de busca para as datas comerciais que se aproximam.',
      enabled: engine.mode !== 'off', state: engine.mode === 'off' ? 'off' : engineLast?.status === 'failed' ? 'attention' : engine.mode === 'shadow' ? 'idle' : 'ok',
      schedule: 'Depois de cada importação', last: engineLast ?? (engineState ? { at: engineState.at, status: 'succeeded', summary: `${engineState.created} sugestões novas` } : null),
      nextAt: engine.mode === 'off' || !importSettings.enabled ? null : nextDailyAt(importAt, now),
      note: engine.mode === 'shadow' ? 'Modo sombra: só registra o que faria, não pede nada. Mude para “Com aprovação” quando concordar com o que ela sugere.' : engine.mode === 'off' ? 'Desligada.' : null,
      href: 'engine',
    },
    {
      id: 'learn', title: 'Aprender com os cliques',
      what: `Compara as categorias pelos cliques reais e pede mais produtos (+${engine.quotaExtra}) nas que rendem acima da média; as postagens também dão prioridade a elas.`,
      enabled: learning.enabled, state: !learning.enabled ? 'off' : learning.enough ? 'ok' : 'idle',
      schedule: 'A cada execução da Engine e a cada postagem planejada', last: null, nextAt: null,
      note: !learning.enabled ? 'Desligada.' : learning.enough ? null : `Ainda sem dados: ${learning.siteClicks} de ${engine.minSiteClicks} cliques nos últimos ${engine.windowDays} dias. Nada muda até lá.`,
      href: 'engine',
    },
    {
      id: 'social', title: 'Postar no Telegram',
      what: `Escolhe as melhores ofertas do dia (${social.dailyLimit} por dia, entre ${social.startHour}h e ${social.endHour}h), escreve o texto com números reais, ${social.requireApproval ? 'espera a sua aprovação' : 'publica no horário'} e confere o preço antes de enviar.`,
      enabled: social.mode === 'on', state: social.mode !== 'on' ? 'off' : !telegramConfigured ? 'attention' : socialState?.failed ? 'attention' : 'ok',
      schedule: 'Planeja o dia e envia o que venceu, a cada 5 minutos', last: socialLast, nextAt: today.nextPostAt,
      note: social.mode !== 'on' ? 'Desligada. Ligue em Postagens quando o canal estiver pronto.' : !telegramConfigured ? 'O bot do Telegram não está configurado: as postagens ficam na fila, sem envio.' : null,
      href: 'postagens',
    },
    {
      id: 'content', title: 'Preparar posts de Instagram e TikTok',
      what: `Prepara a cada dia ${contentSettings.instagramDaily} post(s) de Instagram e ${contentSettings.tiktokDaily} de TikTok, com legenda, roteiro, hashtags, imagem e link com etiqueta do canal. Você publica na rede e marca como publicado.`,
      enabled: contentSettings.instagramDaily + contentSettings.tiktokDaily > 0,
      state: contentSettings.instagramDaily + contentSettings.tiktokDaily === 0 ? 'off' : contentSummary.every((row) => row.planned === 0 || row.published >= row.planned) ? 'ok' : 'attention',
      schedule: 'A cada execução da rotina de postagens (planeja os posts do dia)', last: null, nextAt: null,
      note: contentSettings.instagramDaily + contentSettings.tiktokDaily === 0 ? 'Desligado. Ajuste a quantidade por dia em Instagram e TikTok.'
        : contentSummary.map((row) => `${row.channel === 'instagram' ? 'Instagram' : 'TikTok'}: ${row.published} de ${row.planned} publicado(s) hoje`).join(' · '),
      href: 'redes-sociais',
    },
  ]

  // ---- aprovações
  const proposalViews: ProposalView[] = pendingProposals.map((row) => ({
    id: row.id, kind: row.kind, kindLabel: kindLabels[row.kind] ?? row.kind, title: row.title, reason: row.reason,
    evidence: row.evidence as Record<string, unknown>, status: row.status, createdAt: row.createdAt, expiresAt: row.expiresAt,
  }))
  const postViews: PostView[] = (pendingPosts.rows as { id: string; text: string; image_url: string | null; scheduled_for: string | null; source: string; campaign: string; facts: { name?: string; price?: number } }[]).map((row) => ({
    id: row.id, name: row.facts?.name ?? 'Oferta', text: row.text, imageUrl: row.image_url, scheduledFor: iso(row.scheduled_for),
    source: row.source, campaign: row.campaign, price: typeof row.facts?.price === 'number' ? row.facts.price : null,
  }))

  // ---- atenção
  const attention = (health?.checks ?? []).filter((check) => check.severity !== 'ok')

  // ---- histórico
  const jobLabel: Record<string, { kind: ActivityItem['kind']; title: string }> = {
    catalog_import: { kind: 'import', title: 'Importação do catálogo' },
    conversion_sync: { kind: 'commissions', title: 'Sincronização de comissões' },
    engine_run: { kind: 'engine', title: 'Execução da Engine' },
  }
  const activity: ActivityItem[] = [
    ...(doneRuns.rows as RunRow[]).map((row): ActivityItem => ({
      at: new Date(row.finished_at ?? row.started_at).toISOString(), kind: jobLabel[row.job_type].kind,
      tone: row.status === 'succeeded' ? 'ok' : row.status === 'failed' ? 'bad' : 'neutral',
      title: `${jobLabel[row.job_type].title} ${runStatusLabel[row.status] ?? row.status}`,
      detail: row.job_type === 'catalog_import'
        ? `${row.created_count} novos, ${row.updated_count} atualizados, ${row.rejected_count} saíram da vitrine`
        : row.job_type === 'conversion_sync' ? `${row.processed_count} conversões lidas, ${row.created_count} novas`
        : `${row.created_count} sugestões novas, ${row.updated_count} atualizadas, ${row.rejected_count} expiradas`,
    })),
    ...(donePosts.rows as { id: string; status: string; sent_at: string | null; updated_at: string; error: string | null; facts: { name?: string } }[]).map((row): ActivityItem => ({
      at: new Date(row.sent_at ?? row.updated_at).toISOString(), kind: 'post',
      tone: row.status === 'sent' ? 'ok' : row.status === 'failed' ? 'bad' : 'neutral',
      title: row.status === 'sent' ? 'Postagem enviada ao Telegram' : row.status === 'failed' ? 'Postagem não enviada' : 'Postagem cancelada',
      detail: `${row.facts?.name ?? 'Oferta'}${row.error ? ` — ${String(row.error).slice(0, 140)}` : ''}`,
    })),
    ...(doneProposals.rows as { title: string; status: string; decided_at: string; decision_note: string | null }[]).map((row): ActivityItem => ({
      at: new Date(row.decided_at).toISOString(), kind: 'proposal',
      tone: row.status === 'applied' ? 'ok' : row.status === 'failed' ? 'bad' : 'neutral',
      title: row.status === 'applied' ? 'Sugestão aplicada' : row.status === 'rejected' ? 'Sugestão recusada' : 'Sugestão falhou',
      detail: row.title,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40)

  const telegramCommission = commissions ? commissions.byOrigin.filter((row) => row.channel === 'telegram').reduce((sum, row) => sum + row.commission, 0) : 0

  return {
    generatedAt: new Date(now).toISOString(),
    master: { engine: engine.mode, social: social.mode, requireApproval: social.requireApproval, importEnabled: importSettings.enabled, telegramConfigured },
    worker: { state: beatState, lastBeatAt: beat?.at ?? null, startedAt: beat?.startedAt ?? null },
    tasks, approvals: { proposals: proposalViews, posts: postViews }, today, catalog,
    commissions: commissions
      ? { days: 30, pending: commissions.totals.pending.commission, confirmed: commissions.totals.approved.commission + commissions.totals.paid.commission, telegram: telegramCommission, conversions: commissions.totals.conversions }
      : { days: 30, pending: 0, confirmed: 0, telegram: 0, conversions: 0 },
    learning, attention, activity,
  }
}

