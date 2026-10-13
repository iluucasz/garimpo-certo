import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Roda os e2e contra o build de produção (next start), sem a compilação sob demanda do dev server:
// mais rápido, determinístico e é o que vai ao ar.
// Usa a porta 3000 porque o cliente de autenticação leva NEXT_PUBLIC_BETTER_AUTH_URL (http://localhost:3000 no .env)
// embutido no build: em outra porta o painel nunca enxerga a sessão e redireciona para o login. Por isso o
// `pnpm dev` precisa estar parado (reuseExistingServer: false avisa se a porta estiver ocupada).
const port = 3000
export default defineConfig({
  ...base,
  retries: 0,
  use: { ...base.use, baseURL: `http://localhost:${port}` },
  webServer: { command: `next start -p ${port}`, url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 120_000 },
})
