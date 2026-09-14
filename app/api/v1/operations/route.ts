import { authorize, ok } from '@/lib/server/api'
import { circuitStatus, healthSnapshot, listLogs } from '@/lib/server/observability'
export async function GET(request: Request) { const { blocked } = await authorize(request, 'analytics:read'); if (blocked) return blocked; return ok({ health: await healthSnapshot(), logs: listLogs(), circuits: circuitStatus() }) }
