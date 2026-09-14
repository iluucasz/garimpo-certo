import { NextResponse } from 'next/server'
import { healthSnapshot } from '@/lib/server/observability'
export async function GET(){const health=await healthSnapshot();return NextResponse.json(health,{status:health.status==='healthy'?200:503,headers:{'cache-control':'no-store'}})}
