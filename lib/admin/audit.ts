import { db } from '@/lib/db/client'
import { auditLogs } from '@/lib/db/schema'

type AuditEntry = {
  actorUserId: string | null
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
}

/** Esconde campos sensíveis antes de guardar o instantâneo na trilha. */
const sensitive = /password|token|secret|key|cookie/i
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitive.test(key) ? '[oculto]' : redact(item)]))
  }
  return value
}

/** Registra uma ação administrativa. Falha na trilha nunca derruba a operação principal. */
export async function recordAudit(entry: AuditEntry) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === undefined ? null : redact(entry.before),
      after: entry.after === undefined ? null : redact(entry.after),
    })
  } catch (error) {
    console.error('[audit] não foi possível registrar', error instanceof Error ? error.message : error)
  }
}
