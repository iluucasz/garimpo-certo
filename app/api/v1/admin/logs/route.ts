import { desc, inArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { jobQueueEntries } from '@/lib/db/schema'
import { authorize, ok } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

type LogEntry = { id: string; at: string; level: 'erro' | 'aviso'; source: string; message: string; detail: string | null }

/** Problemas reais: importações que falharam ou terminaram parciais e tarefas em segundo plano que não concluíram. */
export async function GET(request: Request) {
  const { blocked } = await authorize(request, 'analytics:read')
  if (blocked) return blocked

  const [runs, jobs] = await Promise.all([
    db.execute(sql`
      select r.id, r.started_at, r.status, r.processed_count,
             (select e.error_message from sync_errors e where e.sync_job_run_id = r.id order by e.created_at desc limit 1) as error_message
      from sync_job_runs r where r.status in ('failed', 'partial') order by r.started_at desc limit 50`),
    db.select().from(jobQueueEntries).where(inArray(jobQueueEntries.status, ['failed', 'dead_letter'])).orderBy(desc(jobQueueEntries.updatedAt)).limit(50),
  ])

  const entries: LogEntry[] = [
    ...(runs.rows as { id: string; started_at: string; status: string; processed_count: number; error_message: string | null }[]).map((row) => ({
      id: row.id,
      at: row.started_at,
      level: (row.status === 'failed' ? 'erro' : 'aviso') as LogEntry['level'],
      source: 'Importação do catálogo',
      message: row.status === 'failed' ? 'A importação falhou.' : 'A importação terminou sem produtos selecionados.',
      detail: row.error_message,
    })),
    ...jobs.map((job) => ({
      id: job.id,
      at: job.updatedAt,
      level: 'erro' as const,
      source: `Tarefa ${job.jobType}`,
      message: job.status === 'dead_letter' ? `Desistiu depois de ${job.attempts} tentativas.` : `Falhou (${job.attempts} de ${job.maxAttempts} tentativas).`,
      detail: job.lastError,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return ok({ entries })
}
