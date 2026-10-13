import { defineConfig, devices } from '@playwright/test'

// Os e2e do painel criam contas de verdade e falam com o banco: precisam das mesmas variáveis do .env.
// E-mail nunca sai nos testes (o cadastro não envia, e as chaves do Brevo são removidas aqui).
try { process.loadEnvFile('.env') } catch { /* sem .env: os testes que precisam do banco avisam */ }
for (const name of ['BREVO_API_KEY', 'brevo', 'EMAIL_FROM']) delete process.env[name]

export default defineConfig({testDir:'./tests/e2e',fullyParallel:true,retries:1,reporter:'list',use:{baseURL:'http://localhost:3000',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 5']}}],webServer:{command:'pnpm dev',url:'http://localhost:3000',reuseExistingServer:true,timeout:120000}})
