import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { getOrCreateProvider } from '@/lib/db/repositories/catalog-import'
import { syncErrors, syncJobRuns, syncJobs } from '@/lib/db/schema'

export type RunOutcome = {
  status: 'succeeded' | 'failed' | 'partial'
  processed?: number; created?: number; updated?: number; rejected?: number
  error?: string
}

/** Abre (e cria, na primeira vez) o registro de execução. Se o banco falhar, o trabalho segue sem histórico. */
export async function openRun(jobType: string, scheduleCron: string) {
  try {
    const providerId = await getOrCreateProvider('shopee', 'Shopee')
    let [job] = await db.select({ id: syncJobs.id }).from(syncJobs).where(and(eq(syncJobs.providerId, providerId), eq(syncJobs.jobType, jobType))).limit(1)
    if (!job) [job] = await db.insert(syncJobs).values({ providerId, jobType, scheduleCron }).returning({ id: syncJobs.id })
    const [run] = await db.insert(syncJobRuns).values({ syncJobId: job.id }).returning({ id: syncJobRuns.id })
    return run.id
  } catch (error) {
    console.error(`[${jobType}] não foi possível abrir o registro da execução`, error instanceof Error ? error.message : error)
    return null
  }
}

export async function closeRun(runId: string | null, outcome: RunOutcome, jobType = 'job') {
  if (!runId) return
  try {
    await db.update(syncJobRuns).set({
      status: outcome.status,
      finishedAt: new Date().toISOString(),
      processedCount: outcome.processed ?? 0,
      createdCount: outcome.created ?? 0,
      updatedCount: outcome.updated ?? 0,
      rejectedCount: outcome.rejected ?? 0,
    }).where(eq(syncJobRuns.id, runId))
    if (outcome.error) await db.insert(syncErrors).values({ syncJobRunId: runId, errorMessage: outcome.error.slice(0, 1000) })
  } catch (error) {
    console.error(`[${jobType}] não foi possível fechar o registro da execução`, error instanceof Error ? error.message : error)
  }
}
