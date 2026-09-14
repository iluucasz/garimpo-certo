import { eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { jobQueueEntries } from '../schema'

export async function listJobs() {
  return db.select().from(jobQueueEntries)
}

export async function enqueueJob(jobType: string, payload: Record<string, unknown>) {
  const [row] = await db.insert(jobQueueEntries).values({ jobType, payload }).returning()
  return row
}

export async function processJob(id: string) {
  const [row] = await db
    .update(jobQueueEntries)
    .set({ status: 'succeeded', attempts: sql`${jobQueueEntries.attempts} + 1`, updatedAt: new Date().toISOString() })
    .where(eq(jobQueueEntries.id, id))
    .returning()
  return row ?? null
}
