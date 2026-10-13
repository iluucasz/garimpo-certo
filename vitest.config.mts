import path from 'node:path'
import { defineConfig } from 'vitest/config'
process.loadEnvFile(path.resolve(import.meta.dirname, '.env'))
// Com TEST_DATABASE_URL (ex.: um branch do Neon só para testes) a suíte não toca o banco de produção.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
// Testes criam contas e pedem redefinicao de senha para enderecos de exemplo: nunca podem enviar e-mail de verdade.
for (const name of ['BREVO_API_KEY', 'brevo', 'EMAIL_FROM']) delete process.env[name]
export default defineConfig({test:{environment:'node',testTimeout:20000,hookTimeout:20000,include:['tests/unit/**/*.test.ts','tests/integration/**/*.test.ts'],coverage:{reporter:['text','json-summary']}},resolve:{alias:{'@':path.resolve(import.meta.dirname,'.')}}})
