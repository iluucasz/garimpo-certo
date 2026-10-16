import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'

export type Severity = 'ok' | 'warning' | 'critical'
export type HealthCheck = { id: string; label: string; severity: Severity; message: string; since: string | null; href: string }
export type OpsHealth = { status: Severity; checkedAt: string; checks: HealthCheck[] }

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Limiares em horas. A importação roda 1×/dia (06:00) e as comissões a cada 3 h; os limites dão folga para uma falha e uma nova tentativa. */
export const thresholds = {
  catalogWarnHours: 30,
  catalogCriticalHours: 54,
  conversionsWarnHours: 8,
  conversionsCriticalHours: 26,
  privacyWarnDays: 10,
  privacyCriticalDays: 15,
  /** O site envia o catálogo inteiro ao navegador (≈ 2 KB por produto): passando disso as páginas ficam pesadas. */
  catalogSizeWarn: 3000,
  catalogSizeCritical: 6000,
} as const

const worst = (...values: Severity[]): Severity => values.includes('critical') ? 'critical' : values.includes('warning') ? 'warning' : 'ok'

export const ageHours = (iso: string | null, now: number) => iso ? (now - new Date(iso).getTime()) / HOUR : null

const phrase = (hours: number) => hours < 48 ? `${Math.max(1, Math.round(hours))} h` : `${Math.round(hours / 24)} dias`

type RunInfo = { startedAt: string | null; status: string | null; error: string | null; lastSuccessAt: string | null }

/** Frescor de uma rotina agendada: ok dentro do prazo; aviso passado o prazo; crítico bem além, ou falhando sem sucesso recente. */
export function evaluateRoutine(input: {
  id: string; label: string; href: string; run: RunInfo; warnHours: number; criticalHours: number; neverMessage: string; now: number
}): HealthCheck {
  const { run, now } = input
  const success = ageHours(run.lastSuccessAt, now)
  const failing = run.status === 'failed'
  const base = { id: input.id, label: input.label, href: input.href }

  if (run.startedAt === null && run.lastSuccessAt === null) return { ...base, severity: 'warning', message: input.neverMessage, since: null }
  if (success === null) return { ...base, severity: failing ? 'critical' : 'warning', message: failing ? `Falhou e nunca concluiu${run.error ? `: ${run.error}` : '.'}` : 'Ainda não concluiu nenhuma execução.', since: run.startedAt }
  if (success > input.criticalHours) return { ...base, severity: 'critical', message: `Sem sucesso há ${phrase(success)}${failing && run.error ? `. Última falha: ${run.error}` : '.'}`, since: run.lastSuccessAt }
  if (success > input.warnHours) return { ...base, severity: 'warning', message: `Última execução com sucesso há ${phrase(success)}${failing ? ', e a mais recente falhou' : ''}.`, since: run.lastSuccessAt }
  if (failing) return { ...base, severity: 'warning', message: `A última execução falhou${run.error ? `: ${run.error}` : ''}. A anterior deu certo há ${phrase(success)}.`, since: run.startedAt }
  return { ...base, severity: 'ok', message: `Última execução com sucesso há ${phrase(success)}.`, since: run.lastSuccessAt }
}

export function evaluatePrivacy(input: { pending: number; oldestAt: string | null; now: number }): HealthCheck {
  const base = { id: 'lgpd', label: 'Pedidos de titulares (LGPD)', href: '/admin/lgpd' }
  if (input.pending === 0 || !input.oldestAt) return { ...base, severity: 'ok', message: 'Nenhum pedido aguardando resposta.', since: null }
  const days = (input.now - new Date(input.oldestAt).getTime()) / DAY
  const severity: Severity = days >= thresholds.privacyCriticalDays ? 'critical' : days >= thresholds.privacyWarnDays ? 'warning' : 'ok'
  const noun = input.pending === 1 ? '1 pedido' : `${input.pending} pedidos`
  const tail = severity === 'critical' ? ' O prazo de 15 dias da LGPD venceu.' : severity === 'warning' ? ' O prazo de 15 dias da LGPD está perto.' : ''
  return { ...base, severity, message: `${noun} aguardando resposta; o mais antigo tem ${Math.floor(days)} ${Math.floor(days) === 1 ? 'dia' : 'dias'}.${tail}`, since: input.oldestAt }
}

/** Tamanho do catálogo ativo. O catálogo pode crescer sem limite, mas o peso das páginas cresce junto. */
export function evaluateCatalogSize(active: number): HealthCheck {
  const base = { id: 'tamanho', label: 'Tamanho do catálogo', href: '/admin/engine', since: null }
  const count = active.toLocaleString('pt-BR')
  if (active >= thresholds.catalogSizeCritical) return { ...base, severity: 'critical', message: `${count} produtos ativos: as páginas estão pesadas. Defina um limite total ou peça a busca no servidor.` }
  if (active >= thresholds.catalogSizeWarn) return { ...base, severity: 'warning', message: `${count} produtos ativos: acima de ${thresholds.catalogSizeWarn.toLocaleString('pt-BR')} o site começa a ficar pesado.` }
  return { ...base, severity: 'ok', message: `${count} produtos ativos.` }
}

export function summarize(checks: HealthCheck[], now: number): OpsHealth {
  return { status: worst(...checks.map((check) => check.severity)), checkedAt: new Date(now).toISOString(), checks }
}

type RunRow = { job_type: string; started_at: string | null; status: string | null; error: string | null; last_success: string | null }

/** Lê o estado real do banco e avalia cada rotina. Nunca lança: se o banco falhar, devolve um alerta crítico. */
export async function getOpsHealth(now = Date.now()): Promise<OpsHealth> {
  try {
    const [runs, catalog, queue, privacy] = await Promise.all([
      db.execute(sql`
        select j.job_type,
               (select r.started_at from sync_job_runs r where r.sync_job_id = j.id order by r.started_at desc limit 1) as started_at,
               (select r.status::text from sync_job_runs r where r.sync_job_id = j.id order by r.started_at desc limit 1) as status,
               (select e.error_message from sync_errors e join sync_job_runs r on r.id = e.sync_job_run_id
                  where r.sync_job_id = j.id order by r.started_at desc, e.created_at desc limit 1) as error,
               (select max(r.finished_at) from sync_job_runs r where r.sync_job_id = j.id and r.status = 'succeeded') as last_success
        from sync_jobs j where j.job_type in ('catalog_import', 'conversion_sync')`),
      db.execute(sql`select max(last_synced_at) as synced_at, count(*)::int as active from offers where status = 'active'`),
      db.execute(sql`select count(*)::int as dead from job_queue_entries where status in ('failed', 'dead_letter') and updated_at > now() - interval '7 days'`),
      db.execute(sql`select count(*)::int as pending, min(requested_at) as oldest from privacy_requests where status in ('pending', 'processing')`),
    ])

    const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null
    const run = (type: string): RunInfo => {
      const row = (runs.rows as RunRow[]).find((item) => item.job_type === type)
      return { startedAt: iso(row?.started_at), status: row?.status ?? null, error: row?.error ? String(row.error).slice(0, 160) : null, lastSuccessAt: iso(row?.last_success) }
    }

    const checks: HealthCheck[] = []

    // Frescor real do catálogo: vale também importação feita à mão.
    const catalogRow = catalog.rows[0] as { synced_at: string | null; active: number }
    const catalogRun = run('catalog_import')
    const syncedAt = iso(catalogRow?.synced_at)
    const freshest = [catalogRun.lastSuccessAt, syncedAt].filter(Boolean).sort().at(-1) ?? null
    checks.push(evaluateRoutine({
      id: 'catalogo', label: 'Importação do catálogo', href: '/admin/imports-jobs', now,
      run: { ...catalogRun, lastSuccessAt: freshest }, warnHours: thresholds.catalogWarnHours, criticalHours: thresholds.catalogCriticalHours,
      neverMessage: 'O catálogo ainda não foi importado.',
    }))

    checks.push(evaluateRoutine({
      id: 'comissoes', label: 'Sincronização de comissões', href: '/admin/analytics', now,
      run: run('conversion_sync'), warnHours: thresholds.conversionsWarnHours, criticalHours: thresholds.conversionsCriticalHours,
      neverMessage: 'Ainda não sincronizou. Atualize o worker da VPS ou use o botão em Analytics.',
    }))

    checks.push(evaluateCatalogSize(Number(catalogRow?.active ?? 0)))

    const dead = Number((queue.rows[0] as { dead: number }).dead)
    checks.push({
      id: 'tarefas', label: 'Tarefas em segundo plano', href: '/admin/logs', since: null,
      severity: dead > 0 ? 'warning' : 'ok',
      message: dead > 0 ? `${dead} ${dead === 1 ? 'tarefa falhou' : 'tarefas falharam'} nos últimos 7 dias.` : 'Nenhuma falha nos últimos 7 dias.',
    })

    const privacyRow = privacy.rows[0] as { pending: number; oldest: string | null }
    checks.push(evaluatePrivacy({ pending: Number(privacyRow.pending), oldestAt: iso(privacyRow.oldest), now }))

    return summarize(checks, now)
  } catch (error) {
    console.error('[ops] não foi possível avaliar a saúde do sistema', error instanceof Error ? error.message : error)
    return summarize([{ id: 'banco', label: 'Banco de dados', severity: 'critical', message: 'Não foi possível consultar o banco.', since: null, href: '/admin/logs' }], now)
  }
}
