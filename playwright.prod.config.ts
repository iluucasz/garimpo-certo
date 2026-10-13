import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Roda os e2e contra o build de produção (next start), sem a compilação sob demanda do dev server:
// mais rápido, determinístico e é o que vai ao ar. Usa outra porta para não colidir com `pnpm dev`.
const port = 3100
export default defineConfig({
  ...base,
  retries: 0,
  use: { ...base.use, baseURL: `http://localhost:${port}` },
  webServer: { command: `next start -p ${port}`, url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 120_000 },
})
