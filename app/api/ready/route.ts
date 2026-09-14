import { NextResponse } from 'next/server'
import { healthSnapshot } from '@/lib/server/observability'
export async function GET(){const health=await healthSnapshot();const ready=health.checks.database.status==='healthy'&&health.checks.worker.status==='healthy'&&health.checks.providerQueue.status==='healthy';return NextResponse.json({ready,checkedAt:health.timestamp,checks:health.checks},{status:ready?200:503,headers:{'cache-control':'no-store'}})}
