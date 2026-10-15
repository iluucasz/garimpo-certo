import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { globalSettings } from '@/lib/db/schema'

/**
 * Sinal de vida do worker da VPS: ele grava a hora a cada minuto, e o painel diz se a Engine está de fato rodando.
 * Sem imports do Next: o worker usa este arquivo.
 */
export type Heartbeat = { at: string; startedAt: string; importAt: string | null }

const KEY = 'worker_heartbeat'

export async function writeHeartbeat(beat: Heartbeat) {
  const now = new Date().toISOString()
  await db.insert(globalSettings).values({ key: KEY, value: beat, updatedAt: now })
    .onConflictDoUpdate({ target: globalSettings.key, set: { value: beat, updatedAt: now } })
}

export async function readHeartbeat(): Promise<Heartbeat | null> {
  const [row] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, KEY)).limit(1)
  const value = row?.value as Heartbeat | undefined
  return value && typeof value.at === 'string' ? value : null
}

/** Online: sinal nos últimos 5 minutos. Atrasado: até 30 minutos. Depois disso, parado. */
export function workerState(beat: Heartbeat | null, now = Date.now()): 'online' | 'stale' | 'offline' | 'unknown' {
  if (!beat) return 'unknown'
  const age = now - new Date(beat.at).getTime()
  if (age <= 5 * 60_000) return 'online'
  if (age <= 30 * 60_000) return 'stale'
  return 'offline'
}
