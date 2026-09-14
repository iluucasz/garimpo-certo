# Backlog — pendências da migração mock → real

Registro do que ficou pendente após a migração de backend/auth/storefront para Neon + Better Auth (2026-09-04/05). Nada aqui é bug — são lacunas conhecidas, deixadas de propósito por escopo/tempo. Ver `CLAUDE.md` para o estado do que **já** está real.

## Prioridade alta

- [ ] **Git init + primeiro commit.** O projeto não tem nenhum histórico de versão salvo — todo o trabalho de migração (schema, auth, API, storefront) existe só no working directory. Rodar `git init`, revisar `.gitignore` (já protege `.env`), e commitar.
- [ ] **LGPD real.** `consentRecords`, `privacyPreferences`, `privacyRequests` existem no schema mas nunca são gravadas — consentimento de cookies continua 100% em `localStorage` (`components/mock-provider.tsx`). É a única lacuna que toca dado sensível de verdade.
- [ ] **E-mail transacional.** `lib/auth/auth.ts#sendResetPassword` só loga o link no console — nenhum provedor (Resend, SendGrid, Postmark) conectado. Sem isso, reset de senha não funciona em produção.
- [ ] **Variáveis de ambiente de produção.** `BETTER_AUTH_URL`/`NEXT_PUBLIC_BETTER_AUTH_URL` apontam para `localhost:3000`. Precisam apontar para o domínio real antes de qualquer deploy.

## Tabelas do schema sem nenhum código usando

Do levantamento em `CLAUDE.md` ("Schema coverage"), continuam com zero referências fora de `schema.ts`/`relations.ts`:

- [ ] `syncJobs` / `syncJobRuns` / `syncErrors` — o sync de providers usa a tabela genérica `jobQueueEntries` em vez dessas, mais específicas para esse fluxo
- [ ] `affiliateLinks` / `affiliatePrograms` — cliques/conversões de afiliado usam `providerId` direto, sem a camada de "link" e "programa"
- [ ] `offerPrices` / `offerAvailability` / `offerCommissions` — os campos equivalentes vivem direto na tabela `offers`; essas seriam para snapshot/histórico normalizado separado
- [ ] `providerAccounts` / `providerCapabilities` — credenciais de API por provider e capacidades declaradas, sem UI/rota nenhuma
- [ ] `anonymousIdentities` / `identityMerges` — resolução de identidade anônimo→logado não implementada
- [ ] `dailyProductMetrics` / `hourlyProductMetrics` — `/api/v1/analytics/rollups` calcula na hora a partir de `analyticsEvents` em vez de usar agregados pré-computados
- [ ] `auditLogs` — mutações do admin não geram trilha de auditoria real
- [ ] `globalSettings` — sem UI/rota de configuração global
- [ ] `productVariants` — variantes de produto (cor, tamanho etc.) não implementadas

## Fora do catálogo (decisão de escopo, não esquecimento)

- [ ] **Coleções editoriais** (`app/colecoes/[slug]`) e **guias** (`app/guias*`) — sem tabela real no schema; continuam servidos por `lib/mock-data.ts`. Precisaria desenhar um schema de conteúdo/CMS antes de migrar.
- [ ] **CRUD genérico do admin** (`components/admin/module-content.tsx`) — ~29 módulos (SEO, tema, campanhas, LGPD, etc.) rodando sobre `LocalRepository`/`localStorage`, a maioria sem tabela real para vincular.
- [ ] **Simulador de ranking do admin** (`components/admin/experience-studio.tsx`) — usa `lib/mock-data` como fallback do motor de recomendação; ferramenta de demonstração, não afeta o cliente final.

## Operacional / infraestrutura

- [ ] **Gestão de admins.** Promover alguém a um papel hoje é manual via `pnpm db:grant-role <email> <ROLE_CODE>` — sem fluxo de convite/UI.
- [ ] **OAuth / login social.** Só e-mail+senha está habilitado no Better Auth.
- [ ] **Isolamento de banco em teste.** `tests/integration/**` roda contra o Neon real (se limpam sozinhos via `afterAll`, mas não há branch dedicado a testes — considerar um branch do Neon só para CI).
- [ ] **Suíte e2e desatualizada.** Não rodei o Playwright desde a migração. `tests/e2e/accessibility.spec.ts` visita `/admin/ranking` sem sessão — hoje isso redireciona para `/entrar`, o que muda a intenção original do teste (testava a página do admin, agora testa o formulário de login).
- [ ] **Catálogo pequeno.** Só 12 produtos reais (a seed original da Shopee), contra 24 no mock antigo — não é um bug, mas vale saber que a "loja" ainda é pequena para demonstração.

## Referência rápida

- Comandos de banco: `pnpm db:generate` / `db:migrate` / `db:pull` / `db:studio` / `db:seed-roles` / `db:grant-role` / `db:seed-catalog`
- Papéis RBAC: `OWNER`, `ADMIN`, `MARKETING`, `CATALOG_MANAGER`, `ANALYST`, `SUPPORT`, `READ_ONLY` (`lib/auth/rbac.ts`)
- Plano original da migração (contexto histórico completo): `~/.claude/plans/crystalline-drifting-turtle.md`
