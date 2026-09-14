import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'
import * as relations from './relations'

neonConfig.webSocketConstructor = ws

declare global { var __garimpoPool: Pool | undefined }

const pool = globalThis.__garimpoPool ?? new Pool({ connectionString: process.env.DATABASE_URL })
globalThis.__garimpoPool = pool

export const db = drizzle(pool, { schema: { ...schema, ...relations } })
