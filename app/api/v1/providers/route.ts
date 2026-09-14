import { listProviders } from '@/lib/db/repositories/providers'
import { ok } from '@/lib/server/api'
export async function GET() { return ok(await listProviders()) }
