import { runEngine } from '@/lib/engine/run'

/** `pnpm engine:run` — executa a Engine agora (a mesma execução do worker e do botão do painel). */
async function main() {
  const state = await runEngine()
  console.log(`Modo: ${state.mode}`)
  console.log(`Novas: ${state.created} · atualizadas: ${state.refreshed} · expiradas: ${state.expired} · aplicadas: ${state.applied}`)
  if (state.coverage) console.log(`Dados: ${state.coverage.siteViews} visitas a produtos (mínimo ${state.coverage.minSiteViews}), ${state.coverage.eligible} candidatos, ${state.coverage.activeProducts} produtos ativos`)
  if (state.note) console.log(state.note)
  process.exit(0)
}

if (process.argv[1]?.includes('run-engine')) main().catch((error) => { console.error(error); process.exit(1) })
