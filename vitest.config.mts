import path from 'node:path'
import { defineConfig } from 'vitest/config'
process.loadEnvFile(path.resolve(import.meta.dirname, '.env'))
export default defineConfig({test:{environment:'node',include:['tests/unit/**/*.test.ts','tests/integration/**/*.test.ts'],coverage:{reporter:['text','json-summary']}},resolve:{alias:{'@':path.resolve(import.meta.dirname,'.')}}})
